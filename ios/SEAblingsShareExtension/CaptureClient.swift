import Foundation

enum CaptureSourceType: String, Encodable {
    case tiktok
    case instagram
    case screenshot
    case manual
    case text
}

struct CaptureRequest: Encodable {
    let userId: String
    let sourceType: CaptureSourceType
    let sourceUrl: String?
    let text: String?
    let screenshotName: String?
    let screenshotBase64: String?
}

enum CaptureClientError: Error {
    case invalidEndpoint
    case invalidResponse
}

final class CaptureClient {
    private let encoder = JSONEncoder()

    func postCapture(_ capture: CaptureRequest) async throws -> Int {
        guard let endpoint = CaptureConfig.captureEndpoint else {
            throw CaptureClientError.invalidEndpoint
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode(capture)

        if CaptureConfig.shouldSendBearerToken {
            request.setValue("Bearer \(CaptureConfig.bearerToken)", forHTTPHeaderField: "Authorization")
        }

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CaptureClientError.invalidResponse
        }

        return httpResponse.statusCode
    }
}
