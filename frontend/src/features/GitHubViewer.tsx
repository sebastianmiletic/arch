import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCommit, GitBranch, Star, Folder, FileText, ExternalLink,
  Loader2, Search, BookOpen, Calendar, User, Code, Eye, AlertCircle,
  ChevronRight, Lock, Plus
} from 'lucide-react';

interface GitHubRepo {
  id: number; name: string; full_name: string;
  description: string | null; html_url: string;
  stargazers_count: number; language: string | null;
  updated_at: string; private: boolean; forks_count: number;
  open_issues_count: number; topics: string[];
}

interface GitHubCommit {
  sha: string; commit: {
    message: string; author: { name: string; date: string };
  }; html_url: string;
}

interface RepoFile {
  name: string; path: string; type: 'file' | 'dir';
  size?: number; html_url: string;
}

export default function GitHubViewer() {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem('arch_github_token') || ''; } catch { return ''; }
  });
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [readme, setReadme] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [showCreateRepo, setShowCreateRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState<'repos' | 'create'>('repos');

  const saveToken = (t: string) => {
    setToken(t);
    try { if (t) localStorage.setItem('arch_github_token', t); else localStorage.removeItem('arch_github_token'); } catch {}
  };

  const headers = (): Record<string, string> => {
    const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
    if (token) h['Authorization'] = `token ${token}`;
    return h;
  };

  const fetchRepos = useCallback(async () => {
    const u = username.trim() || 'user';
    if (!u) return;
    setLoading(true); setError(null);
    try {
      const url = u === 'user' || !username.trim()
        ? 'https://api.github.com/user/repos?sort=updated&per_page=100'
        : `https://api.github.com/users/${u}/repos?sort=updated&per_page=100`;
      const res = await fetch(url, { headers: headers() });
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      const data = await res.json();
      setRepos(data);
    } catch (err) {
      setError((err as Error).message);
    } finally { setLoading(false); }
  }, [username, token]);

  const fetchRepoDetails = useCallback(async (repo: GitHubRepo) => {
    setLoading(true); setError(null);
    try {
      const [commitsRes, filesRes, readmeRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo.full_name}/commits?per_page=10`, { headers: headers() }),
        fetch(`https://api.github.com/repos/${repo.full_name}/contents/`, { headers: headers() }),
        fetch(`https://api.github.com/repos/${repo.full_name}/readme`, { headers: headers() }),
      ]);
      if (commitsRes.ok) setCommits(await commitsRes.json());
      if (filesRes.ok) setFiles(await filesRes.json());
      if (readmeRes.ok) {
        const readmeData = await readmeRes.json();
        setReadme(atob(readmeData.content));
      } else { setReadme(null); }
      setSelectedRepo(repo); setCurrentPath('');
    } catch (err) { setError((err as Error).message);
    } finally { setLoading(false); }
  }, [token]);

  const fetchFileContents = useCallback(async (repo: GitHubRepo, path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${repo.full_name}/contents/${path}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) { setFiles(data); setCurrentPath(path); }
        else { setReadme(atob(data.content)); }
      }
    } catch (err) { setError((err as Error).message);
    } finally { setLoading(false); }
  }, [token]);

  const createRepo = async () => {
    if (!newRepoName.trim() || !token) { setError('Need repo name and token'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRepoName.trim(), description: newRepoDesc.trim(), private: newRepoPrivate }),
      });
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      const repo = await res.json();
      setRepos(prev => [repo, ...prev]);
      setShowCreateRepo(false); setNewRepoName(''); setNewRepoDesc(''); setActiveTab('repos');
    } catch (err) { setError((err as Error).message);
    } finally { setLoading(false); }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch size={16} className="text-accent" />
          <span className="font-bold text-sm text-text-heading">GitHub</span>
          <span className="ml-auto text-[10px] text-text-muted px-2 py-1 rounded bg-bg-surface">{repos.length} repos</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-bg-surface border border-border rounded-lg px-3 py-1.5">
            <User size={12} className="text-text-muted" />
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="GitHub username (leave blank for yours)..."
              className="flex-1 bg-transparent text-[11px] text-text placeholder:text-text-dim focus:outline-none"
              onKeyDown={e => e.key === 'Enter' && fetchRepos()} />
          </div>
          <button onClick={() => setShowTokenInput(!showTokenInput)}
            className={`p-1.5 rounded-lg border transition-colors ${token ? 'border-success/20 text-success' : 'border-border text-text-muted hover:text-text'}`}
            title="Set personal access token"
          >
            {token ? <Lock size={12} /> : <Lock size={12} />}
          </button>
          <button onClick={fetchRepos} disabled={loading}
            className="px-3 py-1.5 bg-accent text-bg text-[11px] font-bold rounded-lg hover:opacity-90 disabled:opacity-20 transition-all"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          </button>
        </div>

        <AnimatePresence>
          {showTokenInput && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
            >
              <div className="mt-2 p-2 bg-bg-surface rounded-lg border border-border"
              >
                <div className="text-[10px] text-text-muted mb-1">Personal Access Token (for private repos, create repos, etc.)</div>
                <input type="password" value={token} onChange={e => saveToken(e.target.value)} placeholder="ghp_..."
                  className="w-full bg-bg border border-border rounded px-2 py-1 text-[11px] text-text focus:outline-none focus:border-accent" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-2 flex items-center gap-1.5 p-2 rounded-lg bg-danger-bg border border-danger/20"
          >
            <AlertCircle size={12} className="text-danger shrink-0" />
            <span className="text-[10px] text-danger">{error}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-2">
          <button onClick={() => { setActiveTab('repos'); setShowCreateRepo(false); }} className={`px-2 py-0.5 text-[10px] rounded-md font-semibold border transition-colors ${activeTab === 'repos' ? 'bg-accent text-bg border-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}
          >Repos</button>
          <button onClick={() => { setActiveTab('create'); setShowCreateRepo(true); }} className={`px-2 py-0.5 text-[10px] rounded-md font-semibold border transition-colors ${activeTab === 'create' ? 'bg-accent text-bg border-accent' : 'border-border text-text-secondary hover:bg-bg-hover'}`}
          >Create Repo</button>
        </div>

        <AnimatePresence>
          {showCreateRepo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
            >
              <div className="mt-2 p-2 bg-bg-surface rounded-lg border border-border space-y-2"
              >
                <div className="text-[10px] text-text-muted mb-1">Create a new GitHub repository</div>
                <input value={newRepoName} onChange={e => setNewRepoName(e.target.value)} placeholder="repo-name"
                  className="w-full bg-bg border border-border rounded px-2 py-1 text-[11px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent" />
                <input value={newRepoDesc} onChange={e => setNewRepoDesc(e.target.value)} placeholder="Description (optional)"
                  className="w-full bg-bg border border-border rounded px-2 py-1 text-[11px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent" />
                <label className="flex items-center gap-2 text-[10px] text-text-secondary cursor-pointer"
                >
                  <input type="checkbox" checked={newRepoPrivate} onChange={e => setNewRepoPrivate(e.target.checked)} className="hidden" />
                  <div className={`w-3 h-3 rounded border flex items-center justify-center ${newRepoPrivate ? 'bg-accent border-accent' : 'border-text-dim/30'}`}>{newRepoPrivate && <Lock size={8} className="text-bg" />}</div>
                  Private repository
                </label>
                <button onClick={createRepo} disabled={!newRepoName.trim() || !token} className="w-full py-1.5 bg-accent text-bg text-[11px] font-bold rounded-lg hover:opacity-90 disabled:opacity-20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus size={11} /> Create Repository
                </button>
                {!token && <span className="text-[9px] text-danger">You need a personal access token to create repos.</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedRepo && activeTab === 'repos' && (
          <div className="p-3 space-y-2">
            {repos.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-text-muted">
                <GitCommit size={24} />
                <span className="text-[11px]">Enter a username and click Search</span>
              </div>
            )}
            {repos.map(repo => (
              <motion.div key={repo.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => fetchRepoDetails(repo)}
                className="border border-border rounded-xl p-3 bg-bg-surface hover:bg-bg-hover cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-[12px] text-text group-hover:text-accent transition-colors">{repo.name}</span>
                  {repo.private && <Lock size={10} className="text-text-muted" />}
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-text-muted">
                    <Star size={10} /> {repo.stargazers_count}
                  </span>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed line-clamp-2">{repo.description || 'No description'}</p>
                <div className="flex items-center gap-3 mt-2">
                  {repo.language && (
                    <span className="flex items-center gap-1 text-[9px] text-text-muted">
                      <Code size={9} /> {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[9px] text-text-muted">
                    <GitBranch size={9} /> {repo.forks_count}
                  </span>
                  <span className="flex items-center gap-1 text-[9px] text-text-muted">
                    <Eye size={9} /> {repo.open_issues_count} issues
                  </span>
                  <span className="ml-auto text-[9px] text-text-dim">
                    <Calendar size={9} className="inline mr-0.5" />
                    {formatDate(repo.updated_at)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {repo.topics?.map(topic => (
                    <span key={topic} className="text-[8px] px-1.5 py-0.5 rounded bg-accent-bg text-accent border border-accent/10">
                      {topic}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {selectedRepo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full"
            >
              <div className="p-3 border-b border-border"
              >
                <button onClick={() => { setSelectedRepo(null); setReadme(null); setCommits([]); setFiles([]); }}
                  className="text-[10px] text-text-muted hover:text-accent flex items-center gap-1 mb-2"
                >
                  <ChevronRight size={10} className="rotate-180" /> Back to repos
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[13px] text-text">{selectedRepo.name}</span>
                  <a href={selectedRepo.html_url} target="_blank" rel="noopener noreferrer"
                    className="text-text-muted hover:text-accent transition-colors"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-[11px] text-text-secondary mt-0.5">{selectedRepo.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-[10px] text-text-muted">
                    <Star size={10} /> {selectedRepo.stargazers_count}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-text-muted">
                    <GitBranch size={10} /> {selectedRepo.forks_count}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-text-muted">
                    <Code size={10} /> {selectedRepo.language || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {readme && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-surface">
                      <BookOpen size={12} className="text-accent" />
                      <span className="text-[11px] font-bold text-text">README</span>
                    </div>
                    <div className="p-3 text-[11px] text-text-secondary whitespace-pre-wrap leading-relaxed">
                      {readme}
                    </div>
                  </div>
                )}

                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-surface">
                    <Folder size={12} className="text-accent" />
                    <span className="text-[11px] font-bold text-text">Files {currentPath && `· ${currentPath}`}</span>
                    {currentPath && (
                      <button onClick={() => {
                        const parent = currentPath.split('/').slice(0, -1).join('/');
                        fetchFileContents(selectedRepo, parent);
                      }} className="text-[10px] text-text-muted hover:text-accent ml-2"
                      >
                        « Up
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-border/50">
                    {files.map(file => (
                      <div key={file.path} onClick={() => {
                        if (file.type === 'dir') fetchFileContents(selectedRepo, file.path);
                      }}
                        className={`flex items-center gap-2 px-3 py-2 text-[11px] transition-colors ${
                          file.type === 'dir' ? 'cursor-pointer hover:bg-bg-hover text-accent' : 'text-text-secondary'
                        }`}
                      >
                        {file.type === 'dir' ? <ChevronRight size={10} /> : <FileText size={10} className="text-text-muted" />}
                        <span className="flex-1 truncate">{file.name}</span>
                        {file.size && file.size > 0 ? <span className="text-[9px] text-text-dim">{formatSize(file.size)}</span> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-surface">
                    <GitCommit size={12} className="text-accent" />
                    <span className="text-[11px] font-bold text-text">Recent Commits</span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {commits.map(commit => (
                      <a key={commit.sha} href={commit.html_url} target="_blank" rel="noopener noreferrer"
                        className="flex flex-col gap-0.5 px-3 py-2 hover:bg-bg-hover transition-colors"
                      >
                        <span className="text-[11px] text-text font-medium truncate">{commit.commit.message.split('\n')[0]}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-text-muted">{commit.commit.author.name}</span>
                          <span className="text-[9px] text-text-dim">{formatDate(commit.commit.author.date)}</span>
                          <span className="text-[9px] text-text-dim font-mono ml-auto">{commit.sha.slice(0, 7)}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
