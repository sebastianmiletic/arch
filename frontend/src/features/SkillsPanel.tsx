import { useStore } from '../stores/appStore';
import { motion } from 'framer-motion';
import {
  Code, Scissors, Bug, CheckCircle, Book, Eye, MessageSquare,
  Languages, Zap, Shield, GitBranch, Database, Search, Globe, Container
} from 'lucide-react';

const iconMap: Record<string, any> = {
  code: Code, scissors: Scissors, bug: Bug, 'check-circle': CheckCircle,
  book: Book, eye: Eye, 'message-square': MessageSquare,
  languages: Languages, zap: Zap, shield: Shield,
  'git-branch': GitBranch, database: Database, search: Search,
  globe: Globe, container: Container,
};

export default function SkillsPanel() {
  const skills = useStore((s: { skills: { id: string; name: string; description: string; icon: string; category: string; enabled: boolean }[]; toggleSkill: (id: string) => void }) => s.skills);
  const toggleSkill = useStore((s: { skills: { id: string; name: string; description: string; icon: string; category: string; enabled: boolean }[]; toggleSkill: (id: string) => void }) => s.toggleSkill);

  const categories = ['core', 'advanced'];
  const categoryLabels: Record<string, string> = { core: 'Core Skills', advanced: 'Advanced' };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center">
          <Zap size={18} className="text-accent" />
        </div>
        <div>
          <h2 className="font-bold text-sm text-text-heading">Skills &amp; Capabilities</h2>
          <p className="text-[11px] text-text-muted">Enable the skills Orion can use to assist you</p>
        </div>
        <div className="ml-auto text-[11px] text-text-muted">
          {skills.filter((s: { enabled: boolean }) => s.enabled).length}/{skills.length} enabled
        </div>
      </div>

      {categories.map((cat: string) => {
        const catSkills = skills.filter((s: { category: string }) => s.category === cat);
        return (
          <div key={cat} className="mb-6">
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3 px-1">{categoryLabels[cat]}</h3>
            <div className="grid grid-cols-1 gap-2">
              {catSkills.map((skill, i) => {
                const Icon = iconMap[skill.icon] || Code;
                return (
                  <motion.div
                    key={skill.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => toggleSkill(skill.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                      skill.enabled
                        ? 'border-accent/20 bg-accent-bg hover:border-accent/40'
                        : 'border-border bg-bg-surface hover:bg-bg-hover'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      skill.enabled ? 'bg-accent/10' : 'bg-bg-hover'
                    }`}>
                      <Icon size={16} className={skill.enabled ? 'text-accent' : 'text-text-muted'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-[12px] ${skill.enabled ? 'text-text' : 'text-text-secondary'}`}>
                          {skill.name}
                        </span>
                        {skill.enabled && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent/10 text-accent uppercase">Active</span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 truncate">{skill.description}</p>
                    </div>
                    <div className={`w-10 h-5 rounded-full flex items-center transition-colors duration-200 shrink-0 ${
                      skill.enabled ? 'bg-accent' : 'bg-bg-hover'
                    }`}>
                      <div className={`w-4 h-4 rounded-full bg-bg transition-transform duration-200 ${
                        skill.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
