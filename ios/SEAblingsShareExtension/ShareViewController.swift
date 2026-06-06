import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let client = CaptureClient()
    private let statusLabel = UILabel()
    private var didStartCapture = false

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        guard !didStartCapture else { return }
        didStartCapture = true

        Task {
            await captureAndFinish()
        }
    }

    private func configureView() {
        view.backgroundColor = .systemBackground

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        statusLabel.font = .preferredFont(forTextStyle: .headline)
        statusLabel.text = "Saving to SEAblings..."

        view.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            statusLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    private func captureAndFinish() async {
        let sharedContent = await extractSharedContent()

        guard let capture = sharedContent.makeCaptureRequest() else {
            finish(message: "Nothing shareable found.")
            return
        }

        do {
            let statusCode = try await client.postCapture(capture)
            finish(message: "Saved to SEAblings (\(statusCode)).")
        } catch {
            // For the demo, never strand the user in the share sheet if local networking fails.
            finish(message: "SEAblings capture failed.")
        }
    }

    @MainActor
    private func finish(message: String) {
        statusLabel.text = message
        extensionContext?.completeRequest(returningItems: nil)
    }

    private func extractSharedContent() async -> SharedContent {
        var content = SharedContent()
        let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] ?? []

        for extensionItem in extensionItems {
            let providers = extensionItem.attachments ?? []

            for provider in providers {
                if content.url == nil {
                    content.url = await loadURL(from: provider)
                }

                if content.text == nil {
                    content.text = await loadText(from: provider)
                }

                if content.imageData == nil {
                    let image = await loadImageData(from: provider)
                    content.imageData = image?.data
                    content.imageName = image?.name
                }
            }
        }

        return content
    }

    private func loadURL(from provider: NSItemProvider) async -> URL? {
        guard provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) else {
            return nil
        }

        do {
            guard let item = try await provider.loadItemAsync(forTypeIdentifier: UTType.url.identifier) else {
                return nil
            }

            return item.asURL
        } catch {
            return nil
        }
    }

    private func loadText(from provider: NSItemProvider) async -> String? {
        let typeIdentifier: String

        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            typeIdentifier = UTType.plainText.identifier
        } else if provider.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
            typeIdentifier = UTType.text.identifier
        } else {
            return nil
        }

        do {
            guard let item = try await provider.loadItemAsync(forTypeIdentifier: typeIdentifier) else {
                return nil
            }

            return item.asText
        } catch {
            return nil
        }
    }

    private func loadImageData(from provider: NSItemProvider) async -> SharedImage? {
        if provider.canLoadObject(ofClass: UIImage.self),
           let image = try? await provider.loadImageAsync(),
           let data = image.jpegData(compressionQuality: 0.86) ?? image.pngData() {
            return SharedImage(name: "shared-screenshot.jpg", data: data)
        }

        guard provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) else {
            return nil
        }

        do {
            guard let item = try await provider.loadItemAsync(forTypeIdentifier: UTType.image.identifier) else {
                return nil
            }

            if let image = item as? UIImage,
               let data = image.jpegData(compressionQuality: 0.86) ?? image.pngData() {
                return SharedImage(name: "shared-screenshot.jpg", data: data)
            }

            if let data = item as? Data {
                return SharedImage(name: "shared-screenshot", data: data)
            }

            if let imageURL = item.asURL {
                let data = try Data(contentsOf: imageURL)
                let name = imageURL.lastPathComponent.isEmpty ? "shared-screenshot" : imageURL.lastPathComponent
                return SharedImage(name: name, data: data)
            }
        } catch {
            return nil
        }

        return nil
    }
}

private struct SharedContent {
    var url: URL?
    var text: String?
    var imageData: Data?
    var imageName: String?

    func makeCaptureRequest() -> CaptureRequest? {
        let trimmedText = normalizedText
        let resolvedURL = url ?? Self.firstURL(in: trimmedText)

        guard resolvedURL != nil || trimmedText != nil || imageData != nil else {
            return nil
        }

        let sourceType: CaptureSourceType

        if imageData != nil {
            sourceType = .screenshot
        } else if let host = resolvedURL?.host?.lowercased(), host.contains("tiktok") {
            sourceType = .tiktok
        } else if let host = resolvedURL?.host?.lowercased(), host.contains("instagram") || host.contains("instagr.am") {
            sourceType = .instagram
        } else {
            sourceType = .text
        }

        return CaptureRequest(
            userId: CaptureConfig.userId,
            sourceType: sourceType,
            sourceUrl: resolvedURL?.absoluteString,
            text: trimmedText,
            screenshotName: imageData == nil ? nil : (imageName ?? "shared-screenshot.jpg"),
            screenshotBase64: imageData?.base64EncodedString()
        )
    }

    private var normalizedText: String? {
        guard let text = text?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
            return nil
        }

        return text
    }

    private static func firstURL(in text: String?) -> URL? {
        guard let text else { return nil }

        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return detector?.firstMatch(in: text, options: [], range: range)?.url
    }
}

private struct SharedImage {
    let name: String
    let data: Data
}

private extension NSItemProvider {
    func loadItemAsync(forTypeIdentifier typeIdentifier: String) async throws -> NSSecureCoding? {
        try await withCheckedThrowingContinuation { continuation in
            loadItem(forTypeIdentifier: typeIdentifier, options: nil) { item, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: item)
                }
            }
        }
    }

    func loadImageAsync() async throws -> UIImage {
        try await withCheckedThrowingContinuation { continuation in
            loadObject(ofClass: UIImage.self) { object, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                if let image = object as? UIImage {
                    continuation.resume(returning: image)
                } else {
                    continuation.resume(throwing: CocoaError(.fileReadUnknown))
                }
            }
        }
    }
}

private extension NSSecureCoding {
    var asURL: URL? {
        if let url = self as? URL {
            return url
        }

        if let string = self as? String {
            return URL(string: string)
        }

        if let data = self as? Data,
           let string = String(data: data, encoding: .utf8) {
            return URL(string: string)
        }

        return nil
    }

    var asText: String? {
        if let string = self as? String {
            return string
        }

        if let url = self as? URL {
            return url.absoluteString
        }

        if let data = self as? Data {
            return String(data: data, encoding: .utf8)
        }

        return nil
    }
}
