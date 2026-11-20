import React from "react";

export default function CarLogo({ size = 72 }) {
  return (
    <div style={{ flex: "none", width: size, height: size, borderRadius: size * 0.29, background: "linear-gradient(160deg,#FFF1F0,#FFE0DD)", display: "grid", placeItems: "center", boxShadow: "0 6px 16px rgba(229,50,45,.22)" }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size * 0.8} height={size * 0.8}>
        <path d="M6 44v-7c0-3 2-5 5-6l7-11c1-2 3-3 5-3h18c2 0 4 1 5 3l7 11c3 1 5 3 5 6v7c0 2-1 3-3 3h-4a7 7 0 0 1-14 0H27a7 7 0 0 1-14 0H9c-2 0-3-1-3-3z" fill="#E5322D" />
        <path d="M22 21h9v10H18zM34 21h8l6 10H34z" fill="#FFF1F0" />
        <circle cx="20" cy="47" r="5.5" fill="#1F2430" />
        <circle cx="44" cy="47" r="5.5" fill="#1F2430" />
        <circle cx="20" cy="47" r="2.2" fill="#FFF1F0" />
        <circle cx="44" cy="47" r="2.2" fill="#FFF1F0" />
        <rect x="8" y="38" width="5" height="3" rx="1.5" fill="#FFD166" />
      </svg>
    </div>
  );
}
