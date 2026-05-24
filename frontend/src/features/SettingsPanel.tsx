import { useStore, themes } from '../stores/appStore';
import { Palette, Type, Layout, Rocket, Minimize2, Radio, Save, RefreshCw } from 'lucide-react';
import type { ThemeId, AppSettings } from '../types';

export default function SettingsPanel() {
  const settings = useStore(s => s.settings);
  const setSettings = useStore(s => s.setSettings);
  const setTheme = useStore(s => s.setTheme);

  const update = (key: keyof AppSettings, value: any) => {
    setSettings({ [key]: value });
    if (key === 'theme') setTheme(value as ThemeId);
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center">
          <RefreshCw size={18} className="text-accent" />
        </div>
        <div>
          <h2 className="font-bold text-sm text-text-heading">Settings</h2>
          <p className="text-[11px] text-text-muted">Configure Orion to your preferences</p>
        </div>
      </div>

      <Section icon={Palette} title="Theme" description="Choose your color scheme">
        <div className="grid grid-cols-3 gap-2">
          {Object.values(themes).map((t: any) => (
            <button
              key={t.id}
              onClick={() => update('theme', t.id)}
              className={`relative p-3 rounded-xl border-2 transition-all duration-200 ${
                settings.theme === t.id ? 'border-accent shadow-lg' : 'border-border hover:border-border-strong'
              }`}
              style={{ background: t.bg }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ background: t.accent }} />
                <div className="w-3 h-3 rounded-full" style={{ background: t.text }} />
                <div className="w-3 h-3 rounded-full" style={{ background: t.bgSurface }} />
              </div>
              <span className="text-[11px] font-semibold" style={{ color: t.text }}>{t.name}</span>
              {settings.theme === t.id && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Type} title="Typography" description="Adjust text display">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-text-secondary">Font Size</span>
            <div className="flex items-center gap-1 bg-bg-surface rounded-lg p-0.5">
              {(['sm', 'md', 'lg'] as const).map(size => (
                <button key={size} onClick={() => update('fontSize', size)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                    settings.fontSize === size ? 'bg-accent text-bg' : 'text-text-secondary hover:text-text'
                  }`}
                >
                  {size === 'sm' && 'Small'}{size === 'md' && 'Medium'}{size === 'lg' && 'Large'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-text-secondary">Font Family</span>
            <div className="flex items-center gap-1 bg-bg-surface rounded-lg p-0.5">
              {(['sans', 'mono'] as const).map(fam => (
                <button key={fam} onClick={() => update('fontFamily', fam)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                    settings.fontFamily === fam ? 'bg-accent text-bg' : 'text-text-secondary hover:text-text'
                  }`}
                >
                  {fam === 'sans' ? 'System' : 'Mono'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section icon={Layout} title="Layout" description="Panel dimensions">
        <div className="space-y-3">
          <RangeSetting label="Sidebar Width" value={settings.sidebarWidth} min={220} max={400} onChange={(v: number) => update('sidebarWidth', v)} />
          <RangeSetting label="Chat Panel Width" value={settings.chatWidth} min={280} max={450} onChange={(v: number) => update('chatWidth', v)} />
        </div>
      </Section>

      <Section icon={Rocket} title="Behavior" description="App behavior settings">
        <div className="space-y-2">
          <ToggleSetting label="Animations" description="Enable UI animations" icon={RefreshCw} value={settings.animations} onChange={(v: boolean) => update('animations', v)} />
          <ToggleSetting label="Auto-save" description="Automatically save session state" icon={Save} value={settings.autoSave} onChange={(v: boolean) => update('autoSave', v)} />
          <ToggleSetting label="Minimize to Tray" description="Keep running in background" icon={Minimize2} value={settings.minimizeToTray} onChange={(v: boolean) => update('minimizeToTray', v)} />
          <ToggleSetting label="Telemetry" description="Send anonymous usage data" icon={Radio} value={settings.telemetry} onChange={(v: boolean) => update('telemetry', v)} />
        </div>
      </Section>

      <div className="mt-6 p-4 rounded-xl border border-danger/20 bg-danger-bg">
        <h3 className="text-[12px] font-bold text-danger mb-2">Reset</h3>
        <button className="px-4 py-2 text-[11px] font-semibold bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors"
          onClick={() => { if (confirm('Reset all settings to defaults?')) { localStorage.clear(); window.location.reload(); } }}
        >
          Reset All Settings
        </button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, description, children }: any) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-accent" />
        <div>
          <h3 className="text-[12px] font-bold text-text">{title}</h3>
          <p className="text-[10px] text-text-muted">{description}</p>
        </div>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  );
}

function RangeSetting({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-text-secondary w-28 shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 bg-bg-surface rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, var(--color-accent) ${((value - min) / (max - min)) * 100}%, var(--color-bg-surface) ${((value - min) / (max - min)) * 100}%)` }}
      />
      <span className="text-[11px] text-text-muted w-12 text-right font-mono">{value}px</span>
    </div>
  );
}

function ToggleSetting({ label, description, icon: Icon, value, onChange }: { label: string; description: string; icon: any; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-bg-hover transition-colors">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-text-muted" />
        <div>
          <div className="text-[12px] text-text font-medium">{label}</div>
          <div className="text-[10px] text-text-muted">{description}</div>
        </div>
      </div>
      <button onClick={() => onChange(!value)} className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${value ? 'bg-accent' : 'bg-bg-hover'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-bg transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
