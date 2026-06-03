import Foundation
import ActivityKit

@available(iOS 16.1, *)
public struct IntercomOverlayAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var count: Int
        public var labels: [String]
        public var latch: [Bool]
        public var listen: [Bool]
        public var micAllowed: [Bool]
        public var listenAllowed: [Bool]
        public var activity: [Bool]
        public var updatedAt: Date

        public init(
            count: Int,
            labels: [String],
            latch: [Bool],
            listen: [Bool],
            micAllowed: [Bool],
            listenAllowed: [Bool],
            activity: [Bool],
            updatedAt: Date = Date()
        ) {
            self.count = count
            self.labels = labels
            self.latch = latch
            self.listen = listen
            self.micAllowed = micAllowed
            self.listenAllowed = listenAllowed
            self.activity = activity
            self.updatedAt = updatedAt
        }

        private enum CodingKeys: String, CodingKey {
            case count
            case labels
            case latch
            case listen
            case micAllowed
            case listenAllowed
            case activity
            case updatedAt
        }

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            self.count = try container.decode(Int.self, forKey: .count)
            self.labels = try container.decode([String].self, forKey: .labels)
            self.latch = try container.decode([Bool].self, forKey: .latch)
            self.listen = try container.decode([Bool].self, forKey: .listen)
            self.micAllowed = try container.decode([Bool].self, forKey: .micAllowed)
            self.listenAllowed = try container.decode([Bool].self, forKey: .listenAllowed)
            self.activity = try container.decode([Bool].self, forKey: .activity)
            self.updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt) ?? Date()
        }
    }

    public var title: String

    public init(title: String = "Intercom") {
        self.title = title
    }
}
