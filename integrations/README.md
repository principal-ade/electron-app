# Integration Guides

This directory contains integration guides for new features and package updates that require code changes in the electron app.

## Available Guides

### [MDX Editor Status Indicators](./MDX_EDITOR_STATUS_INDICATORS.md)
**Package**: `@industry-theme/file-editing-panels@0.3.12`
**Status**: Ready for integration
**Priority**: Medium

Shows document status (unsaved/uncommitted/untracked) in the MDX editor toolbar.

- ✅ Event-based mode works immediately after package update
- ⏳ Prop-controlled mode requires tab structure updates (recommended)
- See guide for step-by-step integration instructions

---

## How to Use These Guides

1. **Read the guide** for the feature you want to integrate
2. **Update packages** as instructed
3. **Test event-based mode** (if applicable) to verify basic functionality
4. **Implement advanced features** (like prop-controlled mode) following the step-by-step instructions
5. **Test thoroughly** with the provided test scenarios
6. **Mark as complete** by updating the status in the guide

## Contributing

When adding new integration guides:
1. Use the format: `FEATURE_NAME.md`
2. Include: Overview, Integration Steps, Testing, Troubleshooting
3. Update this README with a link to your guide
4. Include package version and status
