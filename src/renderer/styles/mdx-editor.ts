// Centralized imports for the MDX editor styles so that they are always
// available, even when the editor bundle is code-split from the main UI.
// These imports must remain side-effectful.
import '@mdxeditor/editor/style.css';
import '@principal-ade/industry-themed-mdx-editor/styles.css';

// Inject CSS to fix Tailwind's heading reset for MDX editor
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    /* Override Tailwind's heading reset for MDX Editor */
    .themed-mdx-editor h1,
    .themed-mdx-editor h2,
    .themed-mdx-editor h3,
    .themed-mdx-editor h4,
    .themed-mdx-editor h5,
    .themed-mdx-editor h6 {
      font-size: revert !important;
      font-weight: revert !important;
    }

    /* Ensure proper heading sizes in MDX editor content */
    .themed-mdx-editor [class*='contentEditable'] h1,
    .themed-mdx-editor .ProseMirror h1 {
      font-size: 2em !important;
      font-weight: 700 !important;
      margin: 0.67em 0 !important;
    }

    .themed-mdx-editor [class*='contentEditable'] h2,
    .themed-mdx-editor .ProseMirror h2 {
      font-size: 1.5em !important;
      font-weight: 600 !important;
      margin: 0.75em 0 !important;
    }

    .themed-mdx-editor [class*='contentEditable'] h3,
    .themed-mdx-editor .ProseMirror h3 {
      font-size: 1.25em !important;
      font-weight: 600 !important;
      margin: 0.83em 0 !important;
    }

    .themed-mdx-editor [class*='contentEditable'] h4,
    .themed-mdx-editor .ProseMirror h4 {
      font-size: 1em !important;
      font-weight: 600 !important;
      margin: 1em 0 !important;
    }

    .themed-mdx-editor [class*='contentEditable'] h5,
    .themed-mdx-editor .ProseMirror h5 {
      font-size: 0.875em !important;
      font-weight: 600 !important;
      margin: 1.17em 0 !important;
    }

    .themed-mdx-editor [class*='contentEditable'] h6,
    .themed-mdx-editor .ProseMirror h6 {
      font-size: 0.75em !important;
      font-weight: 600 !important;
      margin: 1.33em 0 !important;
    }
  `;
  document.head.appendChild(style);
}
