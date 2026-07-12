// Kit-only chrome: lets you browse all three HOWie experiences (the real app
// decides persona from the signed-in account). Sits outside the device frame.
import { getKitPersona, setKitPersona, type Persona } from "../api";

const OPTIONS: [Persona, string][] = [
  ["athlete", "Athlete"],
  ["parent", "Parent"],
  ["coach", "Coach"],
];

export function PersonaSwitcher() {
  const current = getKitPersona();
  return (
    <div
      style={{
        position: "fixed", bottom: 12, left: "50%", transform: "translateX(-50%)",
        zIndex: 9999, display: "flex", gap: 4, padding: 4,
        background: "#FFFFFFF2", border: "1px solid #E3E0DA", borderRadius: 999,
        boxShadow: "0 2px 12px rgba(26,26,26,0.10)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {OPTIONS.map(([p, label]) => (
        <button
          key={p}
          type="button"
          title={`View the ${label.toLowerCase()} app`}
          onClick={() => {
            if (p !== current) {
              setKitPersona(p);
              location.reload();
            }
          }}
          style={{
            border: "none", borderRadius: 999, padding: "6px 14px", cursor: "pointer",
            fontSize: 12, fontWeight: 600, letterSpacing: 0.2,
            background: p === current ? "#1A1A1A" : "transparent",
            color: p === current ? "#F7F6F3" : "#1A1A1A",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
