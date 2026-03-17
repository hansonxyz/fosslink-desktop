/**
 * Color theme definitions.
 *
 * Each theme overrides the CSS custom properties defined in theme.css.
 * Only color-related variables are included — typography, spacing, and
 * radius tokens stay constant across all themes.
 */

export interface ThemeColors {
  // Backgrounds
  '--bg-primary': string
  '--bg-secondary': string
  '--bg-surface': string
  '--bg-hover': string
  '--bg-selected': string
  // Text
  '--text-primary': string
  '--text-secondary': string
  '--text-muted': string
  // Accents
  '--accent-primary': string
  '--accent-secondary': string
  // Message bubbles
  '--bubble-received': string
  '--bubble-sent': string
  '--bubble-sent-text': string
  // Semantic
  '--border': string
  '--danger': string
  '--success': string
  '--warning': string
  // Links (used in message bubbles)
  '--link-color': string
  '--link-visited': string
  // Scrollbar
  '--scrollbar-thumb': string
  '--scrollbar-thumb-hover': string
}

export interface ThemeDef {
  id: string
  name: string
  category: 'dark' | 'light'
  colors: ThemeColors
}

export const themes: ThemeDef[] = [
  // ── Dark themes ──────────────────────────────────────────────

  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    category: 'dark',
    colors: {
      '--bg-primary': '#1a1a2e',
      '--bg-secondary': '#16213e',
      '--bg-surface': '#1e2746',
      '--bg-hover': '#263054',
      '--bg-selected': '#2a3a5c',
      '--text-primary': '#e0e0e0',
      '--text-secondary': '#a0a0b0',
      '--text-muted': '#6a6a7a',
      '--accent-primary': '#5b8def',
      '--accent-secondary': '#7c4dff',
      '--bubble-received': '#2a2a3e',
      '--bubble-sent': '#3a5ba0',
      '--bubble-sent-text': '#e0e0e0',
      '--border': '#2a2a3e',
      '--danger': '#ef5350',
      '--success': '#4caf50',
      '--warning': '#ffa726',
      '--link-color': '#6ea8fe',
      '--link-visited': '#9ec5fe',
      '--scrollbar-thumb': '#6a6a7a',
      '--scrollbar-thumb-hover': '#a0a0b0',
    },
  },

  {
    id: 'dracula',
    name: 'Dracula',
    category: 'dark',
    colors: {
      '--bg-primary': '#0d0d0d',
      '--bg-secondary': '#141418',
      '--bg-surface': '#1a1a22',
      '--bg-hover': '#24242e',
      '--bg-selected': '#2c2c3a',
      '--text-primary': '#e8e8e8',
      '--text-secondary': '#a8a8b8',
      '--text-muted': '#636373',
      '--accent-primary': '#7b68ee',
      '--accent-secondary': '#e06c9f',
      '--bubble-received': '#1e1e28',
      '--bubble-sent': '#4a3a7a',
      '--bubble-sent-text': '#e8e8e8',
      '--border': '#2a2a36',
      '--danger': '#ff6b6b',
      '--success': '#50fa7b',
      '--warning': '#ffb86c',
      '--link-color': '#a898ee',
      '--link-visited': '#c4b8f8',
      '--scrollbar-thumb': '#636373',
      '--scrollbar-thumb-hover': '#a8a8b8',
    },
  },

  {
    id: 'nord',
    name: 'Nord',
    category: 'dark',
    colors: {
      '--bg-primary': '#2e3440',
      '--bg-secondary': '#2a3038',
      '--bg-surface': '#3b4252',
      '--bg-hover': '#434c5e',
      '--bg-selected': '#4c566a',
      '--text-primary': '#eceff4',
      '--text-secondary': '#d8dee9',
      '--text-muted': '#7b88a1',
      '--accent-primary': '#88c0d0',
      '--accent-secondary': '#81a1c1',
      '--bubble-received': '#3b4252',
      '--bubble-sent': '#4e6a8a',
      '--bubble-sent-text': '#eceff4',
      '--border': '#3b4252',
      '--danger': '#bf616a',
      '--success': '#a3be8c',
      '--warning': '#ebcb8b',
      '--link-color': '#88c0d0',
      '--link-visited': '#a3d4e0',
      '--scrollbar-thumb': '#4c566a',
      '--scrollbar-thumb-hover': '#7b88a1',
    },
  },

  {
    id: 'monokai',
    name: 'Monokai',
    category: 'dark',
    colors: {
      '--bg-primary': '#1e1f1c',
      '--bg-secondary': '#272822',
      '--bg-surface': '#2d2e27',
      '--bg-hover': '#383930',
      '--bg-selected': '#44453a',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#c0c0b0',
      '--text-muted': '#75715e',
      '--accent-primary': '#a6e22e',
      '--accent-secondary': '#fd971f',
      '--bubble-received': '#2d2e27',
      '--bubble-sent': '#4a5a2a',
      '--bubble-sent-text': '#f8f8f2',
      '--border': '#3e3f38',
      '--danger': '#f92672',
      '--success': '#a6e22e',
      '--warning': '#fd971f',
      '--link-color': '#66d9ef',
      '--link-visited': '#ae81ff',
      '--scrollbar-thumb': '#75715e',
      '--scrollbar-thumb-hover': '#c0c0b0',
    },
  },

  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    category: 'dark',
    colors: {
      '--bg-primary': '#002b36',
      '--bg-secondary': '#073642',
      '--bg-surface': '#0a3e4a',
      '--bg-hover': '#124858',
      '--bg-selected': '#1a5568',
      '--text-primary': '#eee8d5',
      '--text-secondary': '#b0aa94',
      '--text-muted': '#657b83',
      '--accent-primary': '#b58900',
      '--accent-secondary': '#cb4b16',
      '--bubble-received': '#073642',
      '--bubble-sent': '#4a5a00',
      '--bubble-sent-text': '#eee8d5',
      '--border': '#0d4654',
      '--danger': '#dc322f',
      '--success': '#859900',
      '--warning': '#b58900',
      '--link-color': '#268bd2',
      '--link-visited': '#6c9cc2',
      '--scrollbar-thumb': '#657b83',
      '--scrollbar-thumb-hover': '#839496',
    },
  },

  {
    id: 'gruvbox',
    name: 'Gruvbox',
    category: 'dark',
    colors: {
      '--bg-primary': '#1d2021',
      '--bg-secondary': '#282828',
      '--bg-surface': '#32302f',
      '--bg-hover': '#3c3836',
      '--bg-selected': '#504945',
      '--text-primary': '#ebdbb2',
      '--text-secondary': '#bdae93',
      '--text-muted': '#7c6f64',
      '--accent-primary': '#fe8019',
      '--accent-secondary': '#83a598',
      '--bubble-received': '#32302f',
      '--bubble-sent': '#6a4a28',
      '--bubble-sent-text': '#ebdbb2',
      '--border': '#3c3836',
      '--danger': '#fb4934',
      '--success': '#b8bb26',
      '--warning': '#fabd2f',
      '--link-color': '#83a598',
      '--link-visited': '#a8c4b4',
      '--scrollbar-thumb': '#7c6f64',
      '--scrollbar-thumb-hover': '#a89984',
    },
  },

  // ── Light themes ─────────────────────────────────────────────

  {
    id: 'rose',
    name: 'Rose',
    category: 'light',
    colors: {
      '--bg-primary': '#fdf2f4',
      '--bg-secondary': '#f8e8ec',
      '--bg-surface': '#f0dce2',
      '--bg-hover': '#ebd0d8',
      '--bg-selected': '#e4c3ce',
      '--text-primary': '#3a2228',
      '--text-secondary': '#6b4450',
      '--text-muted': '#a07080',
      '--accent-primary': '#d4687a',
      '--accent-secondary': '#c07090',
      '--bubble-received': '#f0dce2',
      '--bubble-sent': '#d4687a',
      '--bubble-sent-text': '#ffffff',
      '--border': '#e4c3ce',
      '--danger': '#d32f2f',
      '--success': '#4a8c5c',
      '--warning': '#d48a0c',
      '--link-color': '#b04060',
      '--link-visited': '#8a3050',
      '--scrollbar-thumb': '#d4b0ba',
      '--scrollbar-thumb-hover': '#c09aa6',
    },
  },

  {
    id: 'lavender',
    name: 'Lavender',
    category: 'light',
    colors: {
      '--bg-primary': '#f5f0fa',
      '--bg-secondary': '#ece4f6',
      '--bg-surface': '#e2d8ee',
      '--bg-hover': '#d8cce6',
      '--bg-selected': '#cebfdc',
      '--text-primary': '#2a2040',
      '--text-secondary': '#524068',
      '--text-muted': '#8878a0',
      '--accent-primary': '#7e57c2',
      '--accent-secondary': '#9c6ade',
      '--bubble-received': '#e2d8ee',
      '--bubble-sent': '#7e57c2',
      '--bubble-sent-text': '#ffffff',
      '--border': '#d0c4e0',
      '--danger': '#d32f2f',
      '--success': '#4a8c5c',
      '--warning': '#d48a0c',
      '--link-color': '#6040a0',
      '--link-visited': '#7e57c2',
      '--scrollbar-thumb': '#c4b4d8',
      '--scrollbar-thumb-hover': '#a898c0',
    },
  },

  {
    id: 'sage',
    name: 'Sage',
    category: 'light',
    colors: {
      '--bg-primary': '#f0f5f0',
      '--bg-secondary': '#e4eee4',
      '--bg-surface': '#d8e6d8',
      '--bg-hover': '#ccdccc',
      '--bg-selected': '#c0d2c0',
      '--text-primary': '#1e2e1e',
      '--text-secondary': '#3e5a3e',
      '--text-muted': '#6e8a6e',
      '--accent-primary': '#4a8c5c',
      '--accent-secondary': '#2e7d5a',
      '--bubble-received': '#d8e6d8',
      '--bubble-sent': '#4a8c5c',
      '--bubble-sent-text': '#ffffff',
      '--border': '#c0d2c0',
      '--danger': '#d32f2f',
      '--success': '#3a7c4c',
      '--warning': '#c88a10',
      '--link-color': '#2e6a4a',
      '--link-visited': '#3a5c4a',
      '--scrollbar-thumb': '#b0c8b0',
      '--scrollbar-thumb-hover': '#90b090',
    },
  },

  {
    id: 'peach',
    name: 'Peach',
    category: 'light',
    colors: {
      '--bg-primary': '#fef6f0',
      '--bg-secondary': '#faeee4',
      '--bg-surface': '#f2e0d2',
      '--bg-hover': '#ecd4c4',
      '--bg-selected': '#e4c8b6',
      '--text-primary': '#3a2820',
      '--text-secondary': '#6a4838',
      '--text-muted': '#a07860',
      '--accent-primary': '#e07040',
      '--accent-secondary': '#d08858',
      '--bubble-received': '#f2e0d2',
      '--bubble-sent': '#e07040',
      '--bubble-sent-text': '#ffffff',
      '--border': '#e4ccba',
      '--danger': '#d32f2f',
      '--success': '#4a8c5c',
      '--warning': '#d08000',
      '--link-color': '#c05830',
      '--link-visited': '#a04828',
      '--scrollbar-thumb': '#d4bca8',
      '--scrollbar-thumb-hover': '#c0a890',
    },
  },
]

/** Look up a theme by ID, falling back to the default */
export function getThemeById(id: string): ThemeDef {
  return themes.find((t) => t.id === id) ?? themes[0]!
}

/** Apply a theme's colors to the document root */
export function applyTheme(theme: ThemeDef): void {
  const root = document.documentElement
  for (const [prop, value] of Object.entries(theme.colors)) {
    root.style.setProperty(prop, value)
  }
}
