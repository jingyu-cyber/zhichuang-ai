import { Dashboard } from "../pages/Dashboard";
import { useTheme } from "./ThemeContext";

export function App() {
  const { theme, toggleTheme } = useTheme();
  return (
    <>
      <Dashboard />
      <button
        onClick={toggleTheme}
        aria-label={theme === "light" ? "切换到暗色主题" : "切换到亮色主题"}
        title={theme === "light" ? "暗色主题" : "亮色主题"}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 100,
          width: 44,
          height: 44,
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--line)",
          borderRadius: 10,
          background: "var(--paper)",
          color: "var(--ink)",
          cursor: "pointer",
          fontSize: 18,
          boxShadow: "var(--shadow)",
          transition: "var(--theme-transition)",
        }}
      >
        {theme === "light" ? "🌙" : "☀️"}
      </button>
    </>
  );
}
