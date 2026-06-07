const { saveTopic, getTopicByDate } = require('../db/queries');

// 40 curated system design topics (HLD + LLD), rotated daily.
// No external API needed — topics are high quality and free.
const TOPICS = [
  // ── HLD ───────────────────────────────────────────────────────────────────
  { topic: 'Load Balancing', category: 'HLD',
    description: 'Load balancers distribute traffic across servers so no single node is overwhelmed. Study round-robin, least-connections, and IP-hash algorithms, plus the difference between L4 and L7 load balancing.',
    keyPoints: ['Round-robin & weighted', 'L4 vs L7', 'Health checks', 'Sticky sessions'] },

  { topic: 'Caching Strategies', category: 'HLD',
    description: 'Caching reduces latency and DB load by storing hot data in fast storage. Study cache-aside, write-through, and write-behind patterns along with eviction policies (LRU, LFU) and tools like Redis.',
    keyPoints: ['Cache-aside', 'Write-through / write-behind', 'LRU eviction', 'Cache stampede'] },

  { topic: 'Database Sharding', category: 'HLD',
    description: 'Sharding partitions data across multiple DB nodes to scale writes and storage horizontally. Study range-based vs hash-based sharding, cross-shard queries, and resharding challenges.',
    keyPoints: ['Range vs hash sharding', 'Hot-spot keys', 'Cross-shard joins', 'Resharding'] },

  { topic: 'CAP Theorem', category: 'HLD',
    description: 'A distributed system can only guarantee two of: Consistency, Availability, Partition Tolerance. Study the PACELC extension, eventual consistency, and how Cassandra, MongoDB, and Zookeeper make trade-offs.',
    keyPoints: ['CP vs AP systems', 'Eventual consistency', 'PACELC', 'Real-world examples'] },

  { topic: 'Message Queues & Kafka', category: 'HLD',
    description: 'Message queues decouple producers from consumers enabling async processing. Study at-least-once vs exactly-once delivery, consumer groups, partitions, offsets, and fan-out patterns with Kafka.',
    keyPoints: ['Partitions & offsets', 'Consumer groups', 'At-least-once delivery', 'Dead letter queue'] },

  { topic: 'Rate Limiting', category: 'HLD',
    description: 'Rate limiting protects services from abuse and ensures fair resource usage. Study token bucket, leaky bucket, fixed-window, and sliding-window counter algorithms. Understand distributed rate limiting with Redis.',
    keyPoints: ['Token bucket', 'Sliding window', 'Redis + Lua scripts', 'Per-user vs per-IP'] },

  { topic: 'Content Delivery Networks', category: 'HLD',
    description: 'CDNs cache static assets at edge servers worldwide to reduce latency. Study push vs pull CDN models, cache invalidation strategies, origin shield, and how CDNs handle dynamic and personalised content.',
    keyPoints: ['Push vs pull CDN', 'Cache invalidation', 'Edge locations', 'Origin shield'] },

  { topic: 'Consistent Hashing', category: 'HLD',
    description: 'Consistent hashing minimises data redistribution when nodes join or leave. Study the hash ring concept, virtual nodes for even load distribution, and how it solves hotspot problems in distributed caches.',
    keyPoints: ['Hash ring', 'Virtual nodes', 'Minimal remapping', 'Used in Dynamo & Cassandra'] },

  { topic: 'Microservices vs Monolith', category: 'HLD',
    description: 'Microservices split functionality into independently deployable services, while monoliths keep everything together. Study service boundaries, inter-service communication patterns, data isolation, and when each architecture fits.',
    keyPoints: ['Service boundaries', 'REST vs gRPC', 'Data isolation', 'When to split'] },

  { topic: 'API Gateway Pattern', category: 'HLD',
    description: 'An API gateway is the single entry point for clients, handling routing, auth, rate limiting, and protocol translation. Study the gateway vs service mesh, BFF pattern, and tools like Kong and AWS API Gateway.',
    keyPoints: ['Request routing', 'Auth & rate limiting', 'BFF pattern', 'Service mesh vs gateway'] },

  { topic: 'WebSockets & Real-time Communication', category: 'HLD',
    description: 'WebSockets enable full-duplex persistent connections for real-time features like chat and live feeds. Study WebSocket vs SSE vs long polling, connection management at scale, and sticky sessions with load balancers.',
    keyPoints: ['WebSocket handshake', 'SSE vs WebSocket', 'Sticky sessions', 'Pub/Sub at scale'] },

  { topic: 'Event-Driven Architecture', category: 'HLD',
    description: 'Events drive state changes and enable loose coupling between services. Study event sourcing, CQRS, choreography vs orchestration sagas, and how Kafka enables event-driven microservices.',
    keyPoints: ['Event sourcing', 'CQRS', 'Choreography vs orchestration', 'Eventual consistency'] },

  { topic: 'Database Replication', category: 'HLD',
    description: 'Replication copies data across multiple nodes for availability and read scaling. Study primary-replica replication, multi-primary setups, synchronous vs asynchronous replication, and replication lag impact.',
    keyPoints: ['Primary-replica', 'Sync vs async replication', 'Replication lag', 'Failover & leader election'] },

  { topic: 'Distributed Transactions & Saga Pattern', category: 'HLD',
    description: 'Maintaining data consistency across services without 2PC is solved by the Saga pattern. Study choreography vs orchestration sagas, compensating transactions, and idempotency for retries.',
    keyPoints: ['2PC problems', 'Saga choreography', 'Compensating transactions', 'Idempotency'] },

  { topic: 'Service Discovery', category: 'HLD',
    description: 'Service discovery lets services find each other without hardcoded addresses. Study client-side vs server-side discovery, DNS-based discovery, and tools like Consul, Eureka, and Kubernetes service discovery.',
    keyPoints: ['Client vs server-side', 'Health checking', 'Consul & Kubernetes DNS', 'Load balancer integration'] },

  { topic: 'Circuit Breaker Pattern', category: 'HLD',
    description: 'Circuit breakers prevent cascading failures by stopping calls to failing services. Study the three states (closed, open, half-open), fallback strategies, bulkhead pattern, and implementations like Resilience4j.',
    keyPoints: ['Closed / open / half-open', 'Fallbacks', 'Bulkhead isolation', 'Timeout tuning'] },

  { topic: 'Bloom Filters', category: 'HLD',
    description: 'Bloom filters are space-efficient probabilistic structures for set membership testing with no false negatives. Study the bit-array and hash function design, false positive rate tuning, and use cases like duplicate URL detection.',
    keyPoints: ['False positives (no negatives)', 'Bit array + k hash functions', 'Space efficiency', 'Use cases in CDN & DB'] },

  { topic: 'Leader Election & Consensus', category: 'HLD',
    description: 'Leader election ensures exactly one node acts as coordinator. Study Raft and Paxos consensus algorithms, split-brain prevention, and how etcd and Zookeeper implement leader election for Kubernetes and Kafka.',
    keyPoints: ['Raft consensus', 'Split-brain', 'etcd & Zookeeper', 'Fencing tokens'] },

  { topic: 'Distributed Locking', category: 'HLD',
    description: 'Distributed locks prevent concurrent access to shared resources across processes. Study Redis-based locking (Redlock), Zookeeper ephemeral nodes, lock expiry, clock drift issues, and fencing tokens for correctness.',
    keyPoints: ['Redlock algorithm', 'Fencing tokens', 'Clock drift problem', 'Lock expiry & renewal'] },

  { topic: 'Search Systems & Elasticsearch', category: 'HLD',
    description: 'Full-text search at scale requires inverted indexes, relevance scoring, and distributed sharding. Study how Elasticsearch builds inverted indexes, TF-IDF and BM25 scoring, sharding strategy, and real-time indexing pipelines.',
    keyPoints: ['Inverted index', 'TF-IDF / BM25', 'Shard routing', 'Near real-time search'] },

  // ── LLD ───────────────────────────────────────────────────────────────────
  { topic: 'SOLID Principles', category: 'LLD',
    description: 'SOLID is five principles for clean, maintainable OOP design. Study Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion with real code examples and common violations.',
    keyPoints: ['Single Responsibility', 'Open-Closed', 'Liskov Substitution', 'Dependency Inversion'] },

  { topic: 'Factory & Abstract Factory Pattern', category: 'LLD',
    description: 'Factory patterns abstract object creation to decouple instantiation from usage. Study Simple Factory, Factory Method, and Abstract Factory. Understand when to use each and how they support the open-closed principle.',
    keyPoints: ['Factory Method vs Abstract Factory', 'Decoupling creation', 'Open-closed principle', 'Real-world examples'] },

  { topic: 'Observer Pattern', category: 'LLD',
    description: 'Observer defines a one-to-many dependency so state changes notify all dependents automatically. Study push vs pull models, event emitters, and how React state, Redux, and pub-sub messaging systems use this pattern.',
    keyPoints: ['Subject & Observer roles', 'Push vs pull', 'Event emitters in Node.js', 'Pub/sub relation'] },

  { topic: 'Strategy Pattern', category: 'LLD',
    description: 'Strategy encapsulates interchangeable algorithms behind a common interface. Study how it eliminates if-else chains, enables runtime algorithm switching, and how sorting comparators and payment processors are classic examples.',
    keyPoints: ['Context, Strategy, ConcreteStrategy', 'Runtime switching', 'Eliminates conditionals', 'Comparator example'] },

  { topic: 'Decorator Pattern', category: 'LLD',
    description: 'Decorator attaches additional behaviour to objects dynamically without subclassing. Study how it wraps objects, stacks behaviours, and how Express.js middleware and Python decorators embody this concept.',
    keyPoints: ['Wrapper composition', 'Stacking decorators', 'Express middleware', 'vs inheritance'] },

  { topic: 'Builder Pattern', category: 'LLD',
    description: 'Builder separates complex object construction from its representation using a step-by-step fluent interface. Study when to use it over telescoping constructors and how query builders and test fixture factories use it.',
    keyPoints: ['Fluent interface', 'Director class', 'vs Telescoping constructor', 'Query builder example'] },

  { topic: 'Command Pattern', category: 'LLD',
    description: 'Command encapsulates a request as an object enabling undo/redo, queuing, and logging. Study invoker, command, and receiver roles, and how it enables macro recording, transaction history, and job queues.',
    keyPoints: ['Invoker, Command, Receiver', 'Undo / redo stack', 'Job queue use case', 'Macro recording'] },

  { topic: 'Adapter & Facade Patterns', category: 'LLD',
    description: 'Adapter converts one interface to another that clients expect. Facade simplifies a complex subsystem behind a single interface. Study the difference, when to apply each, and how third-party library wrappers use both.',
    keyPoints: ['Class vs Object Adapter', 'Facade simplification', 'Legacy integration', 'Third-party wrapping'] },

  { topic: 'Parking Lot System Design', category: 'LLD',
    description: 'Design a multi-level parking lot with vehicle types, dynamic spot allocation, and payment. Study OOP modelling for ParkingLot, Level, Spot, Ticket, and Vehicle classes. Cover concurrency for simultaneous entry/exit.',
    keyPoints: ['Class hierarchy', 'Spot allocation strategy', 'Payment processing', 'Concurrency handling'] },

  { topic: 'Elevator System Design', category: 'LLD',
    description: 'Design an elevator system with optimal request scheduling. Study the SCAN/LOOK dispatch algorithm, OOP modelling for Elevator, Floor, Button, and Controller. Optimise for minimum wait time and energy.',
    keyPoints: ['SCAN / LOOK algorithm', 'Request queue', 'State machine', 'Multiple elevators'] },

  { topic: 'Library Management System', category: 'LLD',
    description: 'Design a library system with cataloguing, member management, and loan tracking. Study search by title/author/ISBN, reservation queues, fine calculation logic, and notifications when reserved books become available.',
    keyPoints: ['Book catalogue & search', 'Loan & return flow', 'Reservation queue', 'Fine calculation'] },

  { topic: 'Splitwise Expense Splitting', category: 'LLD',
    description: 'Design an expense-splitting app. Study expense models, debt simplification using graph algorithms (minimize transactions), group management, settlement tracking, and handling multiple currencies.',
    keyPoints: ['Expense model', 'Graph-based debt simplification', 'Group splitting', 'Settlement tracking'] },

  { topic: 'BookMyShow Ticket Booking', category: 'LLD',
    description: 'Design a movie ticket booking system with concurrent seat selection. Study optimistic vs pessimistic locking for seat holds, seat map modelling, booking expiry timers, and payment integration.',
    keyPoints: ['Seat locking strategy', 'Booking expiry', 'Seat map model', 'Payment & confirmation'] },

  { topic: 'Uber Ride Matching', category: 'LLD',
    description: 'Design a ride-matching system. Study geospatial indexing (quadtree, geohash) for nearby driver search, real-time location updates, trip state machine, surge pricing, and driver-rider matching algorithms.',
    keyPoints: ['Geohash / quadtree', 'Trip state machine', 'Real-time location', 'Surge pricing'] },

  { topic: 'Chess Game Design', category: 'LLD',
    description: 'Design a chess game with full move validation, check/checkmate detection, and special moves. Study OOP modelling for Board, Piece, Player, and Move. Cover castling, en passant, pawn promotion, and game history.',
    keyPoints: ['Piece polymorphism', 'Move validation', 'Check/checkmate detection', 'Special moves'] },

  { topic: 'Rate Limiter — LLD', category: 'LLD',
    description: 'Design a rate limiter component from scratch. Implement token bucket and sliding window counter, compare in-memory vs distributed (Redis) storage, handle per-user and per-IP limits, and return standard rate-limit headers.',
    keyPoints: ['Token bucket implementation', 'Sliding window counter', 'Redis INCR + EXPIRE', 'Rate-limit headers'] },

  { topic: 'Notification Service', category: 'LLD',
    description: 'Design a multi-channel notification service (email, SMS, push). Study template management, priority queues for urgency, retry logic with exponential backoff, user preference management, and deduplication.',
    keyPoints: ['Multi-channel dispatch', 'Priority queuing', 'Retry with backoff', 'User preferences'] },

  { topic: 'URL Shortener — LLD', category: 'LLD',
    description: 'Design a URL shortener like bit.ly. Study base-62 encoding for short codes, hash collision handling, custom aliases, TTL-based expiry, click analytics, and caching popular URLs close to the redirect path.',
    keyPoints: ['Base-62 encoding', 'Collision handling', 'Analytics tracking', 'Caching redirects'] },

  { topic: 'Job Queue System', category: 'LLD',
    description: 'Design a background job processing system. Study job scheduling, priority queues, worker pool management, retry policies with exponential backoff, dead letter queues, and job status tracking.',
    keyPoints: ['Worker pool', 'Priority queue', 'Retry + DLQ', 'Job status tracking'] },

  { topic: 'Singleton & Dependency Injection', category: 'LLD',
    description: 'Singleton ensures one instance per class; Dependency Injection decouples object creation from usage. Study thread-safe singleton implementations, why DI is preferred over singletons, and how IoC containers work.',
    keyPoints: ['Double-checked locking', 'DI vs Singleton', 'IoC containers', 'Testability benefits'] },
];

async function getTodaysTopic() {
  const today = new Date().toISOString().split('T')[0];

  // Return from DB if already saved today
  const existing = await getTopicByDate(today);
  if (existing) return existing;

  // Rotate through list by day-of-year so each day has a different topic
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((new Date() - start) / 86400000);
  const { topic, category, description, keyPoints } = TOPICS[dayOfYear % TOPICS.length];

  await saveTopic({ date: today, topic, category, description, keyPoints });
  return { date: today, topic, category, description, keyPoints };
}

module.exports = { getTodaysTopic };
