export function activate(context: any) {
  const styleId = 'catppuccin-latte-theme';
  
  // Clean up existing style if it exists (allows for reloading)
  const existing = document.getElementById(styleId);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    :root {
      /* --- Catppuccin Latte (Light) --- */
      
      /* Backgrounds */
      --bg-primary: #eff1f5;   /* Base */
      --bg-secondary: #e6e9ef; /* Mantle */
      --bg-tertiary: #dce0e8;  /* Crust */
      
      /* Text */
      --text-primary: #4c4f69; /* Text */
      --text-secondary: #6c6f85; /* Subtext0 */
      --text-muted: #9ca0b0;     /* Overlay0 */
      --text-inverted: #eff1f5;  /* Base (on accent) */

      /* Borders & Surfaces */
      --border-color: #ccd0da;   /* Surface0 */
      --border-hover: #bcc0cc;   /* Surface1 */
      --border-focus: #acb0be;   /* Surface2 */

      /* Accents */
      --accent: #1e66f5;         /* Blue */
      --accent-hover: #7287fd;   /* Lavender */

      /* Syntax Highlighting */
      --hl-keyword: #8839ef;     /* Mauve */
      --hl-function: #1e66f5;    /* Blue */
      --hl-type: #df8e1d;        /* Yellow */
      --hl-string: #40a02b;      /* Green */
      --hl-number: #fe640b;      /* Peach */
      --hl-comment: #7c7f93;     /* Overlay2 */
      --hl-operator: #04a5e5;    /* Sky */
      --hl-variable: #4c4f69;    /* Text */
      --hl-constant: #fe640b;    /* Peach */
      --hl-tag: #179299;         /* Teal */
    }
  `;
  
  document.head.appendChild(style);
  context.ui.showNotification("Catppuccin Latte enabled ☕️");
}

export function deactivate() {
  const style = document.getElementById('catppuccin-latte-theme');
  if (style) style.remove();
}