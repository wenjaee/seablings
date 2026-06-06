import Foundation

enum CaptureConfig {
    // Replace this with the LAN URL for the local Next.js API when testing on Jeff's iPhone.
    // Example: "http://192.168.1.23:3000"
    static let apiBaseURLString = "http://192.168.1.23:3000"

    // Leave blank unless the API has SEA_CAPTURE_BEARER_TOKEN configured.
    static let bearerToken = ""

    // Default demo user for VibeHack London.
    static let userId = "jeff"

    static let capturePath = "/api/captures"

    static var captureEndpoint: URL? {
        URL(string: apiBaseURLString)?.appendingPathComponent("api/captures")
    }

    static var shouldSendBearerToken: Bool {
        !bearerToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
