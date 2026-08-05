import { MinimalListSkin } from "./skins/MinimalListSkin";
import { CommandPaletteSkin } from "./skins/CommandPaletteSkin";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">HeadlessHydra</h1>
        <p className="app-subtitle">
        Powerful combobox logic. Zero styling opinions.
        </p>
      </header>

      <div className="app-grid">
        <section className="demo-card">
          <div className="demo-card-head">
            <div>
              <h2 className="demo-card-title">Flight search field</h2>
              <p className="demo-card-desc">
            Fast client-side filtering with full keyboard accessibility.
              </p>
            </div>
            <span className="demo-tag demo-tag--sync">Sync</span>
          </div>
          <div className="demo-card-body">
            <MinimalListSkin />
          </div>
        </section>

        <section className="demo-card">
          <div className="demo-card-head">
            <div>
              <h2 className="demo-card-title">City Command Palette</h2>
              <p className="demo-card-desc">
               Async search with debounced requests and smart response handling.
              </p>
            </div>
            <span className="demo-tag demo-tag--async">Async · ⌘K</span>
          </div>
          <div className="demo-card-body">
            <CommandPaletteSkin />
          </div>
        </section>
      </div>

     
    </div>
  );
}
