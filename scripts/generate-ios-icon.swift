import AppKit

let arguments = CommandLine.arguments
let outputPath = arguments.count > 1
    ? arguments[1]
    : "ios/RealitySync/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"

let size = NSSize(width: 1024, height: 1024)
// A fully opaque RGB bitmap has three samples per pixel. Using four samples
// with hasAlpha=false is an inconsistent NSBitmapImageRep configuration and
// crashes on some Apple Silicon/macOS runner combinations.
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(size.width),
    pixelsHigh: Int(size.height),
    bitsPerSample: 8,
    samplesPerPixel: 3,
    hasAlpha: false,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
) else {
    fatalError("Could not create icon bitmap")
}

bitmap.size = size
guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fatalError("Could not create icon graphics context")
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.shouldAntialias = true

let fullRect = NSRect(origin: .zero, size: size)
let background = NSGradient(colors: [
    NSColor(calibratedRed: 79.0/255.0, green: 70.0/255.0, blue: 229.0/255.0, alpha: 1),
    NSColor(calibratedRed: 124.0/255.0, green: 58.0/255.0, blue: 237.0/255.0, alpha: 1),
])!
background.draw(in: fullRect, angle: -45)

func roundedLine(from start: NSPoint, to end: NSPoint, width: CGFloat, color: NSColor) {
    let path = NSBezierPath()
    path.move(to: start)
    path.line(to: end)
    path.lineWidth = width
    path.lineCapStyle = .round
    color.setStroke()
    path.stroke()
}

roundedLine(from: NSPoint(x: 268, y: 742), to: NSPoint(x: 756, y: 742), width: 48, color: .white)
roundedLine(from: NSPoint(x: 350, y: 640), to: NSPoint(x: 674, y: 640), width: 36, color: NSColor.white.withAlphaComponent(0.64))

let planned = NSBezierPath()
planned.move(to: NSPoint(x: 184, y: 454))
planned.curve(to: NSPoint(x: 448, y: 454), controlPoint1: NSPoint(x: 272, y: 630), controlPoint2: NSPoint(x: 360, y: 630))
planned.curve(to: NSPoint(x: 840, y: 534), controlPoint1: NSPoint(x: 536, y: 278), controlPoint2: NSPoint(x: 664, y: 278))
planned.lineWidth = 34
planned.lineCapStyle = .round
planned.setLineDash([34, 30], count: 2, phase: 0)
NSColor(calibratedRed: 199.0/255.0, green: 210.0/255.0, blue: 254.0/255.0, alpha: 0.78).setStroke()
planned.stroke()

let actual = NSBezierPath()
actual.move(to: NSPoint(x: 184, y: 374))
actual.curve(to: NSPoint(x: 472, y: 374), controlPoint1: NSPoint(x: 280, y: 518), controlPoint2: NSPoint(x: 376, y: 518))
actual.curve(to: NSPoint(x: 840, y: 442), controlPoint1: NSPoint(x: 568, y: 230), controlPoint2: NSPoint(x: 704, y: 230))
actual.lineWidth = 60
actual.lineCapStyle = .round
NSColor.white.setStroke()
actual.stroke()

for point in [NSPoint(x: 184, y: 374), NSPoint(x: 472, y: 374), NSPoint(x: 840, y: 442)] {
    NSColor.white.setFill()
    NSBezierPath(ovalIn: NSRect(x: point.x - 27, y: point.y - 27, width: 54, height: 54)).fill()
}

NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Could not encode icon PNG")
}

let outputURL = URL(fileURLWithPath: outputPath)
try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
try png.write(to: outputURL, options: .atomic)
print("Generated App Store icon: \(outputURL.path)")
