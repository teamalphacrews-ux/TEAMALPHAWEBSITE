import SwiftUI
import UIKit

/// Shared surfaces follow the system appearance; text uses semantic contrast.
enum StudioTheme {
    static let background = adaptive(light: 0xF3F5F9, dark: 0x0D1119)
    static let surface = adaptive(light: 0xFFFFFF, dark: 0x171D28)
    static let raisedSurface = adaptive(light: 0xEAF0F8, dark: 0x202938)
    static let ink = Color.primary
    static let muted = Color.secondary
    static let blue = adaptive(light: 0x235FD4, dark: 0x88ACFF)
    static let orange = adaptive(light: 0xAD4A17, dark: 0xFFB58B)
    static let green = adaptive(light: 0x17784E, dark: 0x73D5A6)
    static let purple = adaptive(light: 0x7453B7, dark: 0xC3ACFF)
    static let divider = Color(uiColor: .separator).opacity(0.35)

    static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let value = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((value >> 16) & 0xFF) / 255,
                           green: CGFloat((value >> 8) & 0xFF) / 255,
                           blue: CGFloat(value & 0xFF) / 255, alpha: 1)
        })
    }

    static func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "converted", "completed", "paid", "done": return green
        case "follow-up", "follow up", "pending", "overdue": return orange
        case "meeting", "in progress", "in-progress": return purple
        case "archived", "cancelled", "canceled": return muted
        default: return blue
        }
    }
}

struct StudioCard<Content: View>: View {
    private let content: Content
    private let padding: CGFloat

    init(padding: CGFloat = 20, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(StudioTheme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .strokeBorder(StudioTheme.divider.opacity(0.5), lineWidth: 0.5)
            }
    }
}

struct StatusPill: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(StudioTheme.statusColor(text))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(StudioTheme.statusColor(text).opacity(0.12), in: Capsule())
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct EmptyStudioState: View {
    let title: String
    let message: String
    let symbol: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: symbol)
                .font(.title2.weight(.medium))
                .foregroundStyle(StudioTheme.blue)
                .padding(12)
                .background(StudioTheme.blue.opacity(0.1), in: RoundedRectangle(cornerRadius: 15))
                .accessibilityHidden(true)
            Text(title).font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
    }
}

struct AmountText: View {
    let amount: Double
    var currency: String = "INR"

    var body: some View {
        Text(amount.isFinite ? amount : 0, format: .currency(code: currency).precision(.fractionLength(0)))
            .monospacedDigit()
            .fixedSize(horizontal: false, vertical: true)
    }
}
