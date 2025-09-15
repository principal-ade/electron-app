/**
 * Test coverage for the Excalidraw save bug in PlanningView
 *
 * Bug Description:
 * When saving an Excalidraw drawing for the first time in PlanningView,
 * the save completes successfully but incorrectly shows a new blank Excalidraw
 * after the save operation instead of maintaining the existing drawing.
 *
 * Root Cause Analysis:
 * The issue appears to be related to how the component handles the diagram ID
 * update after the first save. When ExcalidrawStorageService.saveDiagram returns
 * a new diagram ID, the component updates its state with setSlideDocument, which
 * may trigger a re-render with a new key for the ExcalidrawWrapper component.
 */
import '@testing-library/jest-dom';
//# sourceMappingURL=PlanningView.excalidraw-bug.test.d.ts.map