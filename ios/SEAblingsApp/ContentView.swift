import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("SEAblings")
                .font(.largeTitle.bold())

            Text("Native capture spike")
                .font(.headline)

            Text("Install this app on Jeff's iPhone, then share a URL, text, or screenshot to the SEAblings share extension.")
                .foregroundStyle(.secondary)

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Label("Default user: \(CaptureConfig.userId)", systemImage: "person.crop.circle")
                Label("Endpoint: \(CaptureConfig.capturePath)", systemImage: "square.and.arrow.up")
            }
            .font(.subheadline)
        }
        .padding(24)
    }
}

#Preview {
    ContentView()
}
