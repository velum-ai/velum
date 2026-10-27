// Same 1.5px-stroke line-icon language as src/components/chat/icons.js,
// just for marketing-page use instead of the chat UI.
const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const HashIcon = () => (
  <svg {...base}>
    <line x1="9" y1="3" x2="7" y2="21" />
    <line x1="17" y1="3" x2="15" y2="21" />
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="3" y1="15" x2="19" y2="15" />
  </svg>
);

export const CoinIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M9.5 9.5c0-1.4 1.1-2.5 2.5-2.5s2.5.9 2.5 2c0 2.5-5 1.5-5 4 0 1.1 1.1 2 2.5 2s2.5-1.1 2.5-2.5" />
  </svg>
);

export const ChatIcon = () => (
  <svg {...base}>
    <path d="M4 5h16v11H8l-4 4V5z" />
  </svg>
);

export const ShieldIcon = () => (
  <svg {...base}>
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
  </svg>
);
