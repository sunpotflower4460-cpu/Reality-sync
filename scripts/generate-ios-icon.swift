import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let arguments = CommandLine.arguments
let outputPath = arguments.count > 1
    ? arguments[1]
    : "ios/RealitySync/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"

let width = 1024
let height = 1024
let colorSpace = CGColorSpaceCreateDeviceRGB()
let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue)

guard let context = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: colorSpace,
    bitmapInfo: bitmapInfo.rawValue
) else {
    fatalError("Could not create icon bitmap context")
}

context.setAllowsAntialiasing(true)
context.setShouldAntialias(true)

func rgb(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(colorSpace: colorSpace, components: [red, green, blue, alpha])!
}

let fullRect = CGRect(x: 0, y: 0, width: width, height: height)
let gradientColors = [
    rgb(79.0 / 255.0, 70.0 / 255.0, 229.0 / 255.0),
    rgb(124.0 / 255.0, 58.0 / 255.0, 237.0 / 255.0),
] as CFArray
if let gradient = CGGradient(colorsSpace: colorSpace, colors: gradientColors, locations: [0, 1]) {
    context.drawLinearGradient(
        gradient,
        start: CGPoint(x: fullRect.minX, y: fullRect.minY),
        end: CGPoint(x: fullRect.maxX, y: fullRect.maxY),
        options: []
    )
}

func roundedLine(from start: CGPoint, to end: CGPoint, width: CGFloat, color: CGColor) {
    context.saveGState()
    context.setStrokeColor(color)
    context.setLineWidth(width)
    context.setLineCap(.round)
    context.move(to: start)
    context.addLine(to: end)
    context.strokePath()
    context.restoreGState()
}

roundedLine(from: CGPoint(x: 268, y: 742), to: CGPoint(x: 756, y: 742), width: 48, color: rgb(1, 1, 1))
roundedLine(from: CGPoint(x: 350, y: 640), to: CGPoint(x: 674, y: 640), width: 36, color: rgb(1, 1, 1, 0.64))

context.saveGState()
context.setStrokeColor(rgb(199.0 / 255.0, 210.0 / 255.0, 254.0 / 255.0, 0.78))
context.setLineWidth(34)
context.setLineCap(.round)
context.setLineDash(phase: 0, lengths: [34, 30])
context.move(to: CGPoint(x: 184, y: 454))
context.addCurve(
    to: CGPoint(x: 448, y: 454),
    control1: CGPoint(x: 272, y: 630),
    control2: CGPoint(x: 360, y: 630)
)
context.addCurve(
    to: CGPoint(x: 840, y: 534),
    control1: CGPoint(x: 536, y: 278),
    control2: CGPoint(x: 664, y: 278)
)
context.strokePath()
context.restoreGState()

context.saveGState()
context.setStrokeColor(rgb(1, 1, 1))
context.setLineWidth(60)
context.setLineCap(.round)
context.move(to: CGPoint(x: 184, y: 374))
context.addCurve(
    to: CGPoint(x: 472, y: 374),
    control1: CGPoint(x: 280, y: 518),
    control2: CGPoint(x: 376, y: 518)
)
context.addCurve(
    to: CGPoint(x: 840, y: 442),
    control1: CGPoint(x: 568, y: 230),
    control2: CGPoint(x: 704, y: 230)
)
context.strokePath()
context.restoreGState()

context.setFillColor(rgb(1, 1, 1))
for point in [CGPoint(x: 184, y: 374), CGPoint(x: 472, y: 374), CGPoint(x: 840, y: 442)] {
    context.fillEllipse(in: CGRect(x: point.x - 27, y: point.y - 27, width: 54, height: 54))
}

guard let image = context.makeImage() else {
    fatalError("Could not create icon image")
}

let outputURL = URL(fileURLWithPath: outputPath)
try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
guard let destination = CGImageDestinationCreateWithURL(
    outputURL as CFURL,
    UTType.png.identifier as CFString,
    1,
    nil
) else {
    fatalError("Could not create icon PNG destination")
}
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else {
    fatalError("Could not encode icon PNG")
}

print("Generated App Store icon: \(outputURL.path)")
