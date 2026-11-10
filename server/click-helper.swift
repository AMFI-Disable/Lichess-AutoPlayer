import AppKit
import ApplicationServices
import Foundation

func fail(_ message: String) -> Never { fputs("\(message)\n", stderr); exit(1) }
let args = CommandLine.arguments
if args.count != 10 || !["bullet", "blitz", "rapid", "quick"].contains(args[9]) { fail("Expected window bounds, two screen positions and speed") }
let profiles: [String: (steps: Int, interval: useconds_t, hold: useconds_t, pause: useconds_t)] = [
  "quick": (10, 12000, 50000, 80000),
  "bullet": (14, 18000, 80000, 150000),
  "blitz": (18, 20000, 90000, 220000),
  "rapid": (24, 22000, 100000, 300000)
]
let profile = profiles[args[9]]!
let values = args[1...8].compactMap { Double($0) }
if values.count != 8 || values.contains(where: { !$0.isFinite }) { fail("Invalid coordinates") }
if !AXIsProcessTrusted() { fail("Accessibility permission is required for the terminal running this helper") }
guard let app = NSWorkspace.shared.frontmostApplication,
      ["com.google.Chrome", "org.mozilla.firefox", "com.apple.Safari", "com.microsoft.edgemac"].contains(app.bundleIdentifier ?? "") else { fail("Focus a supported browser first") }
let axApp = AXUIElementCreateApplication(app.processIdentifier)
var windowValue: CFTypeRef?
if AXUIElementCopyAttributeValue(axApp, kAXFocusedWindowAttribute as CFString, &windowValue) != .success { fail("Cannot inspect focused browser window") }
let window = windowValue as! AXUIElement
var titleValue: CFTypeRef?
if AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleValue) != .success || !(titleValue as? String ?? "").lowercased().contains("lichess.org") { fail("Focused browser window is not a Lichess game") }
var positionValue: CFTypeRef?, sizeValue: CFTypeRef?
if AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &positionValue) != .success || AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &sizeValue) != .success { fail("Cannot inspect browser window geometry") }
var origin = CGPoint.zero, size = CGSize.zero
if !AXValueGetValue(positionValue as! AXValue, .cgPoint, &origin) || !AXValueGetValue(sizeValue as! AXValue, .cgSize, &size) { fail("Invalid browser window geometry") }
let tolerance = 8.0
if abs(origin.x-values[0]) > tolerance || abs(origin.y-values[1]) > tolerance || abs(size.width-values[2]) > tolerance || abs(size.height-values[3]) > tolerance { fail("Browser window moved or geometry does not match") }
let points = [CGPoint(x: values[4], y: values[5]), CGPoint(x: values[6], y: values[7])]
if points.contains(where: { !CGRect(origin: origin, size: size).insetBy(dx: 4, dy: 4).contains($0) }) { fail("Move is outside the browser window") }
func checkFocusAndGeometry() {
  guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else { fail("Browser lost focus") }
  var focused: CFTypeRef?, position: CFTypeRef?, dimensions: CFTypeRef?
  guard AXUIElementCopyAttributeValue(axApp, kAXFocusedWindowAttribute as CFString, &focused) == .success,
        let focused, CFEqual(focused, window),
        AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &position) == .success,
        AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &dimensions) == .success else { fail("Browser window changed") }
  var currentOrigin = CGPoint.zero, currentSize = CGSize.zero
  guard AXValueGetValue(position as! AXValue, .cgPoint, &currentOrigin),
        AXValueGetValue(dimensions as! AXValue, .cgSize, &currentSize),
        abs(currentOrigin.x-origin.x) < 1, abs(currentOrigin.y-origin.y) < 1,
        abs(currentSize.width-size.width) < 1, abs(currentSize.height-size.height) < 1 else { fail("Browser window moved") }
}
func movePointer(to target: CGPoint) {
  guard let current = CGEvent(source: nil)?.location else { fail("Cannot read pointer position") }
  let steps = profile.steps
  for step in 1...steps {
    checkFocusAndGeometry()
    let fraction = Double(step) / Double(steps)
    let eased = fraction * fraction * (3 - 2 * fraction)
    let point = CGPoint(x: current.x + (target.x-current.x)*eased, y: current.y + (target.y-current.y)*eased)
    guard let event = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left) else { fail("Could not move pointer") }
    event.post(tap: .cghidEventTap)
    usleep(profile.interval)
  }
}
for (index, point) in points.enumerated() {
  movePointer(to: point)
  checkFocusAndGeometry()
  guard let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left), let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left) else { fail("Could not create mouse events") }
  down.post(tap: .cghidEventTap); usleep(profile.hold); up.post(tap: .cghidEventTap)
  if index == 0 { usleep(profile.pause) }
}
