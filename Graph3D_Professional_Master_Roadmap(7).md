# Graph3D Professional Master Roadmap

## Vision

Build the world's most professional browser-based 3D graphing platform.

## 1. UI/UX

### Equation Editor

-   Professional desktop layout
-   Dedicated mobile layout
-   Lucide icons only
-   No emojis
-   Syntax highlighting
-   Autocomplete
-   Function hints
-   Error highlighting
-   History
-   Multi-cursor
-   Keyboard shortcuts
-   Touch optimized
-   Copy/paste
-   Undo/redo

### Navigation

-   Responsive header
-   Command palette
-   Search
-   Settings
-   Profile
-   Notifications

### Mobile

-   Bottom navigation
-   Floating actions
-   Swipe gestures
-   Large touch targets

## 2. Graph Engine

-   Fix equation parsing
-   Implicit surfaces
-   Parametric surfaces
-   Vector fields
-   Complex expressions
-   Better errors
-   Instant updates

## 3. Rendering

-   GPU optimization
-   Mesh cancellation
-   Memory cleanup
-   LOD
-   Frustum culling
-   Stable FPS

## 4. Backend

-   Authentication
-   Sessions
-   Cloud sync
-   Saved graphs
-   Sharing
-   Rate limiting

## 5. Security

-   CSRF
-   XSS
-   SQL injection protection
-   Secure cookies
-   Validation

## 6. Cloudflare Migration

-   Workers compatibility
-   KV/R2 where appropriate
-   Cache strategy
-   DNS
-   SSL
-   Analytics

## 7. SEO

-   Preserve URLs
-   Sitemap
-   Robots
-   Structured data
-   Open Graph
-   Canonical tags

## 8. Testing

-   Unit tests
-   Integration tests
-   Mobile tests
-   Browser compatibility
-   Lighthouse \>95

## 9. Future

-   Collaboration
-   AI assistant
-   Plugins
-   Premium features
-   PWA
-   Offline support

## Acceptance Criteria

-   Professional quality
-   No student-project appearance
-   Fast on low-end devices
-   Accessible
-   Production-ready

------------------------------------------------------------------------

# 10. Professional Equation Editor (Detailed)

## Goals

Create an editor comparable to professional IDEs while remaining simple
for beginners.

### Layout

-   Separate desktop and mobile interfaces.
-   Resizable equation panel on desktop.
-   Full-screen editor on mobile.
-   Collapsible sidebar.
-   Persistent graph viewport.

### Editing Experience

-   Live syntax highlighting.
-   Automatic bracket matching.
-   Auto-completion for functions, constants and variables.
-   Inline error markers.
-   Equation numbering.
-   Pin/favorite equations.
-   Duplicate equation.
-   Lock equation.
-   Hide/show equation.
-   Color picker with accessible presets.
-   Drag-and-drop reorder.
-   Multi-select operations.
-   Undo/redo history.
-   Copy, paste, duplicate.
-   Keyboard shortcuts.
-   Touch-friendly controls.

### Error Handling

-   Friendly error messages.
-   Highlight exact error position.
-   Suggested fixes.
-   Documentation links.

### Desktop UX

-   Mouse hover tooltips.
-   Right-click context menus.
-   Command palette.
-   Split-panel layout.

### Mobile UX

-   Large buttons.
-   Numeric/function keyboard.
-   Swipe between equations.
-   Bottom sheet interactions.

------------------------------------------------------------------------

# 11. Rendering Engine

-   Incremental mesh generation.
-   Background workers.
-   Adaptive quality.
-   Automatic LOD.
-   GPU resource cleanup.
-   Memory leak prevention.
-   FPS monitoring.
-   Graph loading skeletons.
-   Smooth camera animations.

------------------------------------------------------------------------

# 12. Quality Standards

Every feature must: - Look professionally designed. - Avoid AI-generated
appearance. - Avoid student-project styling. - Use consistent spacing
and typography. - Use Lucide icons. - Contain no emojis. - Be
responsive. - Meet accessibility standards.

------------------------------------------------------------------------

# 13. Complete Mathematical Engine

## Expression Support

-   Arithmetic
-   Trigonometry
-   Hyperbolic functions
-   Inverse trigonometric functions
-   Complex numbers
-   Matrices
-   Vectors
-   Piecewise functions
-   Boolean expressions
-   Logical operators
-   Domain and range restrictions

## Graph Types

-   Cartesian 2D
-   Cartesian 3D
-   Parametric curves
-   Parametric surfaces
-   Implicit curves
-   Implicit surfaces
-   Polar graphs
-   Cylindrical coordinates
-   Spherical coordinates
-   Vector fields
-   Gradient fields
-   Contour plots
-   Heatmaps

## Calculus

-   Symbolic differentiation
-   Numerical differentiation
-   Definite integration
-   Indefinite integration
-   Limits
-   Taylor series
-   Differential equations

------------------------------------------------------------------------

# 14. AI Assistant

## Features

-   Natural language to equations
-   Explain equations
-   Debug equations
-   Optimize expressions
-   Generate examples
-   Step-by-step mathematics
-   Context-aware suggestions
-   Conversation history
-   Safe rate limiting
-   Streaming responses

------------------------------------------------------------------------

# 15. Professional Design System

## Typography

-   Consistent scale
-   Clear hierarchy
-   Responsive sizing

## Components

-   Buttons
-   Cards
-   Dialogs
-   Drawers
-   Tooltips
-   Menus
-   Toast notifications
-   Empty states
-   Loading skeletons
-   Error states

## Visual Standards

-   Consistent spacing
-   Rounded corners
-   Soft shadows
-   High contrast
-   Smooth animations
-   Accessible color palette

------------------------------------------------------------------------

# 16. Production Checklist

-   Zero console errors
-   Zero memory leaks
-   Stable 60 FPS target
-   Mobile optimized
-   Tablet optimized
-   Desktop optimized
-   Cross-browser tested
-   Cloudflare deployment ready
-   SEO verified
-   Security audited
-   Documentation complete

------------------------------------------------------------------------

# 13. Mathematical Engine (Comprehensive)

## Expression Parsing

-   Robust tokenizer
-   AST-based parser
-   Clear syntax errors
-   Custom functions
-   User-defined variables
-   Piecewise functions
-   Boolean expressions
-   Units (future)

## Supported Mathematics

### Algebra

-   Polynomials
-   Rational expressions
-   Factoring
-   Simplification

### Trigonometry

-   Degrees/radians
-   Inverse trig
-   Hyperbolic functions

### Calculus

-   Symbolic differentiation
-   Numerical derivatives
-   Definite integrals
-   Numerical integration
-   Limits
-   Series

### Linear Algebra

-   Vectors
-   Matrices
-   Determinants
-   Eigenvalues
-   Eigenvectors

### Statistics

-   Histograms
-   Regression
-   Probability distributions
-   Statistical summaries

------------------------------------------------------------------------

# 14. Graph Types

-   Cartesian 2D
-   Cartesian 3D
-   Implicit surfaces
-   Parametric curves
-   Parametric surfaces
-   Polar graphs
-   Cylindrical coordinates
-   Spherical coordinates
-   Vector fields
-   Streamlines
-   Point clouds
-   Mesh import
-   Contour plots
-   Heat maps

------------------------------------------------------------------------

# 15. Professional Desktop Workspace

-   Dockable panels
-   Resizable sidebars
-   Multi-tab graphs
-   Split view
-   Full-screen graph mode
-   Command palette
-   Keyboard-first workflow
-   Workspace persistence

------------------------------------------------------------------------

# 16. Mobile Workspace

-   Bottom navigation
-   Gesture navigation
-   Quick equation input
-   One-hand usability
-   Landscape optimization
-   Tablet layout
-   Touch-friendly controls

------------------------------------------------------------------------

# 17. AI Assistant

-   Explain equations
-   Generate graphs
-   Optimize equations
-   Detect mistakes
-   Suggest examples
-   Context-aware help
-   Chat history
-   Secure API integration

------------------------------------------------------------------------

# 18. Release Quality Checklist

Every release must have: - No console errors - No memory leaks - No
broken links - Mobile verification - Desktop verification - Performance
regression tests - Accessibility verification - SEO verification -
Security verification - Documentation updates

------------------------------------------------------------------------

# 19. Professional Design System

## Typography

-   Consistent type scale
-   Accessible font sizes
-   Proper line heights
-   Readable mathematical notation
-   High contrast support

## Color System

-   Light theme
-   Dark theme
-   High contrast theme
-   Color-blind friendly palettes
-   Semantic colors for success, warning and errors

## Components

-   Buttons
-   Cards
-   Dialogs
-   Drawers
-   Dropdowns
-   Context menus
-   Toast notifications
-   Skeleton loaders
-   Empty states
-   Progress indicators

------------------------------------------------------------------------

# 20. Graph Interaction

## Camera

-   Orbit
-   Pan
-   Zoom
-   Reset
-   Saved viewpoints
-   Camera bookmarks
-   Smooth animation
-   Orthographic & perspective modes

## Selection

-   Click selection
-   Multi-selection
-   Hover highlighting
-   Object inspection
-   Measurement tools

## Navigation

-   Mouse controls
-   Keyboard controls
-   Trackpad gestures
-   Mobile gestures
-   Controller support (future)

------------------------------------------------------------------------

# 21. Import & Export

## Import

-   JSON
-   CSV
-   TXT
-   OBJ
-   STL
-   PLY
-   Shared links

## Export

-   PNG
-   SVG
-   PDF
-   OBJ
-   STL
-   GLTF
-   Project backups

------------------------------------------------------------------------

# 22. User Accounts

## Profile

-   Avatar
-   Display name
-   Username
-   Bio
-   Theme preferences
-   Saved workspaces

## Authentication

-   Email/password
-   Password reset
-   Email verification
-   Session management
-   Account deletion

------------------------------------------------------------------------

# 23. Collaboration

-   Shared graphs
-   Read-only links
-   Editable links
-   Comments
-   Version history
-   Activity timeline
-   Team workspaces (future)

------------------------------------------------------------------------

# 24. Accessibility

-   WCAG compliance
-   Keyboard navigation
-   Screen reader support
-   Focus indicators
-   Reduced motion mode
-   Adjustable text size

------------------------------------------------------------------------

# 25. Monitoring

-   Error logging
-   Crash reporting
-   Performance dashboards
-   Usage analytics
-   API monitoring
-   Database monitoring

------------------------------------------------------------------------

# 26. Coding Standards

-   Strict TypeScript
-   Modular architecture
-   Consistent naming
-   No duplicate logic
-   Documentation for every module
-   Unit tests for critical logic
-   Integration tests
-   End-to-end tests

------------------------------------------------------------------------

# 27. Long-Term Vision

Build a graphing platform recognized for:

-   Mathematical correctness
-   Rendering performance
-   Professional interface
-   Excellent mobile experience
-   Accessibility
-   Reliability
-   Security
-   Educational value
-   Research capability
-   Extensibility
-   Production quality

This roadmap is intended to evolve continuously. Every completed feature
should improve quality without sacrificing performance, maintainability
or user experience.

------------------------------------------------------------------------

# 19. Collaboration Features

## Real-Time Collaboration

-   Multi-user editing
-   Live cursors
-   Live equation synchronization
-   Presence indicators
-   Conflict resolution
-   Read-only mode
-   Comment system
-   Activity timeline
-   Version history
-   Restore previous versions

------------------------------------------------------------------------

# 20. Import & Export

## Import

-   Desmos expressions
-   CSV
-   JSON
-   Graph3D project files
-   Images as references
-   Drag-and-drop support

## Export

-   PNG
-   SVG
-   PDF
-   JSON
-   Graph package
-   High-resolution rendering
-   Animated GIF
-   MP4/WebM animation

------------------------------------------------------------------------

# 21. Settings System

## General

-   Language
-   Region
-   Time format
-   Auto-save

## Appearance

-   Light theme
-   Dark theme
-   System theme
-   Font scaling
-   UI density

## Graph

-   Grid visibility
-   Axis styling
-   Lighting presets
-   Shadows
-   Anti-aliasing
-   Quality presets

## Accessibility

-   High contrast
-   Reduced motion
-   Keyboard navigation
-   Screen reader compatibility
-   Color-blind palettes

------------------------------------------------------------------------

# 22. Performance Roadmap

## Initial Load

-   Lazy loading
-   Code splitting
-   Asset preloading
-   Progressive loading

## Runtime

-   Frame budgeting
-   Worker threads
-   Incremental updates
-   Adaptive rendering
-   Memory monitoring

## Mobile Optimization

-   Reduced GPU load
-   Battery-aware rendering
-   Dynamic quality scaling
-   Efficient touch processing

------------------------------------------------------------------------

# 23. Security & Privacy

## Authentication

-   Secure sessions
-   Password reset
-   Email verification
-   Optional 2FA

## Data Protection

-   Encryption in transit
-   Secure storage
-   Audit logging
-   Privacy controls

## API

-   Request validation
-   Rate limiting
-   Abuse detection
-   API versioning

------------------------------------------------------------------------

# 24. Documentation

## User Documentation

-   Getting started
-   Tutorials
-   Keyboard shortcuts
-   FAQ
-   Troubleshooting

## Developer Documentation

-   Architecture
-   API reference
-   Folder structure
-   Coding standards
-   Contribution guide
-   Deployment guide

------------------------------------------------------------------------

# 25. Long-Term Vision

Graph3D should become a complete mathematical platform supporting:

-   Education
-   Research
-   Engineering
-   Architecture
-   Physics
-   Chemistry
-   Data Science
-   Artificial Intelligence
-   Machine Learning visualization
-   Scientific publishing

Every component should be production-grade, highly maintainable,
scalable, and visually comparable with leading professional software
rather than academic or hobby projects.

------------------------------------------------------------------------

# 26. Plugin & Extension Ecosystem

## Goals

Allow third-party developers to safely extend Graph3D.

### Plugin System

-   Secure plugin sandbox
-   Official plugin API
-   Plugin marketplace
-   Plugin permissions
-   Version compatibility
-   Automatic updates
-   User ratings
-   Digital signature verification

### Extension Ideas

-   Engineering calculators
-   Chemistry visualization
-   CAD utilities
-   GIS tools
-   Astronomy modules
-   Financial graphing
-   Education packages

------------------------------------------------------------------------

# 27. Animation Engine

## Timeline

-   Keyframes
-   Timeline editor
-   Playback controls
-   Scrubbing
-   Looping

## Animation Targets

-   Variables
-   Camera
-   Colors
-   Materials
-   Lights
-   Graph visibility

## Export

-   MP4
-   WebM
-   GIF
-   Image sequences

------------------------------------------------------------------------

# 28. Symbolic Mathematics

## Algebra

-   Expand
-   Factor
-   Simplify
-   Collect terms
-   Solve equations
-   Systems of equations

## Calculus

-   Symbolic derivatives
-   Symbolic integrals
-   Taylor series
-   Limits
-   Differential equations

## Linear Algebra

-   Matrix simplification
-   Determinants
-   Inverses
-   Eigen decomposition

------------------------------------------------------------------------

# 29. Professional Design System

## Typography

-   Consistent font scale
-   Responsive sizing
-   Readable mathematical notation

## Components

-   Buttons
-   Inputs
-   Dialogs
-   Cards
-   Tables
-   Menus
-   Tooltips
-   Toasts
-   Context menus

## Design Rules

-   8px spacing system
-   Consistent corner radius
-   Consistent shadows
-   Smooth animations
-   Professional color palette
-   Lucide icons only
-   No emojis
-   No unnecessary gradients

------------------------------------------------------------------------

# 30. Monitoring & Reliability

## Logging

-   Client logs
-   Server logs
-   Error aggregation
-   Performance logs

## Monitoring

-   Uptime monitoring
-   API monitoring
-   Database monitoring
-   Worker monitoring

## Reliability

-   Automatic retries
-   Graceful degradation
-   Offline fallback
-   Backup strategy
-   Disaster recovery

------------------------------------------------------------------------

# 31. Monetization Roadmap (Future)

## Free Tier

-   Core graphing
-   Save graphs
-   Public sharing

## Premium

-   Advanced AI
-   Unlimited projects
-   Collaboration
-   High-resolution exports
-   Advanced rendering
-   Animation tools
-   Priority support

## Enterprise

-   Team workspaces
-   Admin console
-   SSO
-   Audit logs
-   Custom branding

------------------------------------------------------------------------

# 32. Definition of Done

Every completed feature must satisfy ALL of the following:

-   Correct mathematical behavior
-   Responsive on desktop and mobile
-   Accessible
-   Secure
-   Fully tested
-   Documented
-   No console warnings
-   No memory leaks
-   Meets performance targets
-   Matches the design system
-   Professional visual quality
-   Suitable for production release

------------------------------------------------------------------------

# 33. Cloudflare Architecture

## Pages

-   Global CDN
-   Immutable asset caching
-   Preview deployments
-   Branch deployments

## Workers

-   Stateless request handling
-   API routing
-   Authentication middleware
-   AI proxy endpoints

## Storage

-   D1 (relational database)
-   KV (configuration/cache)
-   R2 (exports/assets)
-   Durable Objects (future collaboration)

------------------------------------------------------------------------

# 34. API Design Standards

-   RESTful endpoints
-   Versioned API (/api/v1)
-   Consistent JSON schema
-   Typed request/response models
-   Standard error format
-   Pagination
-   Filtering
-   Sorting
-   Cursor pagination for large datasets

------------------------------------------------------------------------

# 35. Database Standards

## Tables

-   Users
-   Sessions
-   Graphs
-   Projects
-   AI history
-   Exports
-   Teams
-   Audit logs

## Requirements

-   Foreign keys
-   Index optimization
-   Soft deletes
-   Transactions
-   Automatic timestamps
-   Migration history

------------------------------------------------------------------------

# 36. Testing Strategy

## Unit Tests

-   Math parser
-   Graph engine
-   Utilities

## Integration Tests

-   Authentication
-   Database
-   AI
-   Graph saving

## End-to-End

-   Mobile
-   Tablet
-   Desktop
-   Cross-browser
-   Accessibility

------------------------------------------------------------------------

# 37. Performance Targets

-   Initial load \<2s on broadband
-   Interaction latency \<50ms
-   Stable 60 FPS on supported devices
-   Lighthouse Performance ≥95
-   Accessibility ≥95
-   Best Practices ≥95
-   SEO ≥95

------------------------------------------------------------------------

# 38. Version Roadmap

## v1

Stable graphing platform

## v2

Advanced mathematics

## v3

Real-time collaboration

## v4

AI-first workflows

## v5

Enterprise platform

------------------------------------------------------------------------

# 39. Engineering Principles

-   Mathematical correctness first
-   Performance before visual effects
-   Simplicity over unnecessary complexity
-   Maintainable architecture
-   Modular codebase
-   Security by default
-   Accessibility by design
-   Mobile-first thinking
-   Continuous profiling
-   Continuous improvement

------------------------------------------------------------------------

# 40. Accessibility (WCAG 2.2 AA)

## Visual

-   Minimum contrast compliance
-   Scalable typography
-   Focus indicators
-   Color-independent feedback

## Keyboard

-   Full keyboard navigation
-   Shortcut customization
-   Focus trapping in dialogs

## Assistive Technology

-   Screen reader support
-   Semantic HTML
-   ARIA labels where necessary
-   Live region announcements

------------------------------------------------------------------------

# 41. Internationalization (i18n)

-   Language packs
-   RTL layout support
-   Localized dates
-   Localized numbers
-   Unicode math support
-   Runtime language switching

------------------------------------------------------------------------

# 42. Offline Experience

-   Progressive Web App
-   Offline graph editing
-   Cached assets
-   Offline queue for sync
-   Installable application

------------------------------------------------------------------------

# 43. Search & Discovery

-   Global search
-   Search equations
-   Search saved projects
-   Search documentation
-   Command palette search

------------------------------------------------------------------------

# 44. User Dashboard

## Overview

-   Recent graphs
-   Favorites
-   Drafts
-   Shared graphs
-   Storage usage

## Analytics

-   Graph views
-   Downloads
-   Shares
-   AI usage
-   Performance summary

------------------------------------------------------------------------

# 45. Notifications

-   In-app notifications
-   Email notifications
-   Collaboration updates
-   Export completion
-   AI task completion

------------------------------------------------------------------------

# 46. Quality Assurance Checklist

Before every release: - All automated tests pass - Manual regression
completed - Mobile tested - Desktop tested - Tablet tested - No critical
bugs - Documentation updated - Release notes prepared

------------------------------------------------------------------------

# 47. Success Metrics

Technical: - Crash-free sessions \>99.9% - API availability \>99.9% -
Average FPS target achieved

Product: - User retention - Active users - Saved projects - AI usage -
Export success rate

------------------------------------------------------------------------

# 48. Ultimate Product Vision

Graph3D should become a world-class mathematical visualization platform
that is:

-   Fast
-   Accurate
-   Beautiful
-   Accessible
-   Secure
-   Extensible
-   Reliable
-   Educational
-   Research-ready
-   Enterprise-capable

Every screen, interaction, animation, API, database query, rendering
pipeline, and mathematical calculation should meet professional software
engineering standards suitable for long-term maintenance and
global-scale deployment.

------------------------------------------------------------------------

# 49. Rendering Engine Architecture

## Pipeline

-   Expression parsing
-   AST generation
-   Numerical evaluation
-   Geometry generation
-   Mesh optimization
-   GPU upload
-   Scene management
-   Render scheduling

## Rendering Features

-   Frustum culling
-   Level of detail (LOD)
-   Adaptive tessellation
-   Instanced rendering
-   Occlusion culling
-   Dynamic resolution scaling
-   Precision controls

------------------------------------------------------------------------

# 50. Mathematics Roadmap

## Algebra

-   Expressions
-   Polynomials
-   Systems of equations

## Geometry

-   2D geometry
-   3D geometry
-   Coordinate geometry
-   Transformations

## Calculus

-   Limits
-   Derivatives
-   Integrals
-   Vector calculus

## Advanced

-   Differential equations
-   Fourier series
-   Laplace transforms
-   Numerical methods
-   Optimization
-   Complex analysis

------------------------------------------------------------------------

# 51. AI Assistant Evolution

## Phase 1

-   Equation generation
-   Error explanations

## Phase 2

-   Step-by-step solutions
-   Graph interpretation
-   Optimization suggestions

## Phase 3

-   Interactive tutoring
-   Voice conversation
-   Research assistance
-   Natural language graph creation

------------------------------------------------------------------------

# 52. Coding Standards

-   Strict TypeScript
-   Modular architecture
-   SOLID principles
-   Small reusable components
-   Consistent naming
-   Comprehensive comments where needed
-   Zero dead code
-   Zero duplicated logic
-   Mandatory code reviews

------------------------------------------------------------------------

# 53. Release Process

1.  Feature freeze
2.  QA verification
3.  Performance benchmarking
4.  Security audit
5.  Accessibility audit
6.  Documentation update
7.  Beta release
8.  Stable production release
9.  Post-release monitoring

------------------------------------------------------------------------

# 54. Final Mission Statement

The objective is not merely to build another graphing calculator.

The objective is to create a modern mathematical platform capable of
competing with the best graphing applications in usability, mathematical
correctness, performance, visual quality, scalability, reliability, and
developer experience while remaining maintainable for many years.

------------------------------------------------------------------------

# 55. Developer Experience (DX)

## Tooling

-   ESLint with strict rules
-   Prettier formatting
-   Husky pre-commit hooks
-   Conventional commits
-   Automated changelog generation

## Documentation

-   Architecture diagrams
-   Module dependency maps
-   API examples
-   Development onboarding guide

------------------------------------------------------------------------

# 56. Error Handling Standards

## User Facing

-   Friendly error messages
-   Recovery suggestions
-   Retry actions
-   Offline detection

## Internal

-   Structured logging
-   Error IDs
-   Stack trace collection
-   Severity classification

------------------------------------------------------------------------

# 57. Browser Compatibility

## Desktop

-   Chrome
-   Edge
-   Firefox
-   Safari

## Mobile

-   Chrome Android
-   Samsung Internet
-   Safari iOS
-   Firefox Android

------------------------------------------------------------------------

# 58. Analytics

## Product Metrics

-   Active users
-   Feature usage
-   Equation success rate
-   AI usage
-   Export usage

## Performance Metrics

-   Startup time
-   Memory usage
-   Frame time
-   API latency

------------------------------------------------------------------------

# 59. Community

-   Public documentation
-   Feature request portal
-   Bug reporting
-   Community showcase
-   Example gallery
-   Open-source utilities

------------------------------------------------------------------------

# 60. Long-Term Engineering Goals

-   World-class mathematical accuracy
-   Stable public APIs
-   Modular architecture
-   Cloud-native infrastructure
-   Professional UI/UX
-   Outstanding mobile experience
-   Sustainable monetization
-   Continuous innovation
-   Long-term maintainability
-   Global scalability

## Final Principle

Every improvement should make Graph3D: - Faster - Simpler - More
reliable - More accurate - Easier to learn - Easier to maintain - More
valuable for students, educators, engineers, researchers, and
professionals.
