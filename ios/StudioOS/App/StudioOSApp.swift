import SwiftUI

@main struct StudioOSApp: App {
    @UIApplicationDelegateAdaptor(StudioPushAppDelegate.self) private var appDelegate
    @StateObject private var features = StudioDeviceFeatures.shared
    @Environment(\.scenePhase) private var phase
    private let configuration = StudioConfiguration.current
    var body: some Scene {
        WindowGroup {
            Group {
                if let message = configuration.validationError {
                    StudioBetaSetupView(message: message)
                } else {
                    StudioWebWorkspace(configuration: configuration)
                        // WebKit manages editable viewport sizing.
                        .ignoresSafeArea(.keyboard, edges: .bottom)
                }
            }
            .privacySensitive()
            .allowsHitTesting(!features.isLocked && phase == .active)
            .accessibilityHidden(features.isLocked || phase != .active)
            .onChange(of: phase) { _, next in if next == .background { features.lock() } }
            .overlay {
                if phase != .active {
                    ZStack {
                        Color(uiColor: .systemBackground).ignoresSafeArea()
                        Label("Studio OS Ultra", systemImage: "square.3.layers.3d")
                            .font(.title2.weight(.semibold))
                    }.accessibilityHidden(true)
                } else if features.isLocked { StudioPrivacyLockView(features: features) }
            }
        }
    }
}

struct StudioBetaSetupView: View {
    let message: String
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Label("STUDIO OS ULTRA", systemImage: "square.3.layers.3d")
                    .font(.headline).accessibilityAddTraits(.isHeader)
                Text("Commercial beta").font(.caption.weight(.semibold))
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(.blue.opacity(0.12), in: Capsule()).foregroundStyle(.blue)
                Spacer(minLength: 32)
                Image(systemName: "lock.shield").font(.system(size: 48, weight: .light)).foregroundStyle(.blue).accessibilityHidden(true)
                Text("Your next workspace,\nready for verification.")
                    .font(.largeTitle.bold()).fixedSize(horizontal: false, vertical: true)
                Text(message).font(.body).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                Divider()
                Label("Server configuration required", systemImage: "server.rack").font(.subheadline.weight(.semibold))
                Text("Configure this build with your verified commercial environment to begin device testing. Your existing personal studio remains unchanged.")
                    .font(.subheadline).foregroundStyle(.secondary)
                Text("Beta · 0.2.0").font(.caption).foregroundStyle(.secondary).padding(.top, 24)
            }.padding(28).frame(maxWidth: 560, alignment: .leading).frame(maxWidth: .infinity)
        }.background(Color(uiColor: .systemBackground)).tint(.blue)
    }
}
