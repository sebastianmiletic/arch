import { useState, useEffect } from 'react';
import { useStore } from '../../stores/appStore';
import { providersApi } from '../../services/api';
import type { ProviderConfig } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Globe, Key, Thermometer, Hash, X, Save, Check } from 'lucide-react';

export default function ProviderSettings() {
  const providers = useStore(s => s.providers);
  const setProviders = useStore(s => s.setProviders);
  const [selected, setSelected] = useState<ProviderConfig | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { refresh(); }, []);

  async function refresh() {
    const p = await providersApi.list();
    setProviders(p);
  }

  async function toggle(id: string, current: boolean) {
    await providersApi.update(id, { enabled: !current });
    await refresh();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">AI Providers</span>
        </div>
        <p className="text-[11px] text-text-muted">
          {providers.filter(p => p.enabled).length} of {providers.length} enabled
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {providers.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => setSelected(p)}
            className={`border rounded-xl p-3 cursor-pointer transition-all duration-200 ${
              selected?.id === p.id
                ? 'border-accent/30 bg-accent-bg'
                : 'border-border bg-bg-surface hover:border-border-strong'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${p.enabled ? 'bg-success' : 'bg-text-dim'}`} />
                <span className="font-semibold text-[12px] text-text">{p.name}</span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); toggle(p.id, p.enabled); }}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                  p.enabled ? 'bg-accent' : 'bg-bg-hover'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-bg transition-transform duration-200 ${
                  p.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                }`} style={{ transform: p.enabled ? 'translateX(18px)' : 'translateX(2px)' }} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-text-muted">{p.defaultModel}</span>
              {p.baseUrl && <span className="text-[9px] text-text-dim truncate">{p.baseUrl}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border overflow-hidden bg-bg"
          >
            <ProviderEditor
              provider={selected}
              onSave={async (data: any) => {
                await providersApi.update(selected.id, data);
                await refresh();
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
              onTest={async () => {
                setTestStatus({ [selected.id]: 'Testing...' });
                try {
                  const res = await providersApi.test(selected.id);
                  setTestStatus({ [selected.id]: res.ok ? `OK (${res.latency}ms)` : `Failed (${res.latency}ms)` });
                } catch { setTestStatus({ [selected.id]: 'Error' }); }
              }}
              testStatus={testStatus[selected.id] || null}
              saved={saved}
              onClose={() => setSelected(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProviderEditor({ provider, onSave, onTest, testStatus, saved, onClose }: any) {
  const [apiKey, setApiKey] = useState(provider.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl || '');
  const [model, setModel] = useState(provider.defaultModel);
  const [temp, setTemp] = useState(provider.temperature);
  const [maxTokens, setMaxTokens] = useState(provider.maxTokens);

  return (
    <div className="p-3 space-y-2.5 max-h-72 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-[12px] text-text">{provider.name}</span>
        <button onClick={onClose} className="text-text-muted hover:text-text transition-colors p-1">
          <X size={14} />
        </button>
      </div>

      <Field icon={Key} label="API Key">
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full bg-bg-surface border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
        />
      </Field>

      <Field icon={Globe} label="Base URL">
        <input
          value={baseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          placeholder="https://api..."
          className="w-full bg-bg-surface border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
        />
      </Field>

      <Field icon={Hash} label="Model">
        <input
          value={model}
          onChange={e => setModel(e.target.value)}
          className="w-full bg-bg-surface border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text focus:outline-none focus:border-accent transition-colors"
        />
      </Field>

      <div className="flex gap-2">
        <Field icon={Thermometer} label="Temperature">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temp}
              onChange={e => setTemp(Number(e.target.value))}
              className="flex-1 h-1 bg-bg-surface rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--color-accent) ${(temp / 2) * 100}%, var(--color-bg-surface) ${(temp / 2) * 100}%)`,
              }}
            />
            <span className="text-[11px] text-text-muted font-mono w-8 text-right">{temp}</span>
          </div>
        </Field>

        <Field icon={Hash} label="Max Tokens">
          <input
            type="number"
            value={maxTokens}
            onChange={e => setMaxTokens(Number(e.target.value))}
            className="w-full bg-bg-surface border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text focus:outline-none focus:border-accent transition-colors"
          />
        </Field>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSave({ apiKey, baseUrl, defaultModel: model, temperature: temp, maxTokens })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-accent text-bg rounded-lg hover:opacity-90 font-bold transition-all"
        >
          {saved ? <Check size={12} /> : <Save size={12} />}
          {saved ? 'Saved' : 'Save'}
        </button>
        <button
          onClick={onTest}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] border border-border rounded-lg hover:bg-bg-hover transition-colors"
        >
          <Zap size={12} />
          Test
        </button>
        {testStatus && (
          <span className={`text-[11px] font-medium ${testStatus.includes('OK') ? 'text-success' : testStatus.includes('Testing') ? 'text-warning' : 'text-danger'}`}>
            {testStatus}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-dim font-bold">
        <Icon size={10} />
        {label}
      </div>
      {children}
    </div>
  );
}
