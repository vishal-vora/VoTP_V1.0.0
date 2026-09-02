import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Shield,
  Search,
  Plus,
  ArrowRightLeft,
  Cloud,
  HardDrive,
  Settings as SettingsIcon,
  Info,
  GitBranch,
  Star,
  Lock,
  Sparkles,
  Layers,
  Smartphone,
  Tablet,
  Monitor,
  Check,
  AlertTriangle,
  FileCode2,
} from 'lucide-react';
import {
  AppSettings,
  CategoryType,
  CloudBackupState,
  TotpEntry,
  UserAuth,
} from './types/otp';
import {
  DEFAULT_SETTINGS,
  INITIAL_DEMO_ENTRIES,
  loadAppSettings,
  loadCloudBackupState,
  loadUserAuth,
  loadVaultDecrypted,
  saveAppSettings,
  saveVaultEncrypted,
} from './utils/storage';
import { sounds } from './utils/crypto';
import { TitleBar } from './components/TitleBar';
import { AuthModal } from './components/AuthModal';
import { TotpCard } from './components/TotpCard';
import { AddEntryModal } from './components/AddEntryModal';
import { GoogleAuthMigrationModal } from './components/GoogleAuthMigrationModal';
import { CloudBackupModal } from './components/CloudBackupModal';
import { VersionTrackerModal } from './components/VersionTrackerModal';
import { AboutModal } from './components/AboutModal';
import { SettingsModal } from './components/SettingsModal';
import { SQLiteInspectorModal } from './components/SQLiteInspectorModal';
import { SystemTrayWidget } from './components/SystemTrayWidget';
import { QrCodeViewModal } from './components/QrCodeViewModal';
import { EditEntryModal } from './components/EditEntryModal';

export default function App() {
  // Authentication & Session
  const [user, setUser] = useState<UserAuth | null>(null);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [currentPin, setCurrentPin] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // App Settings & Cloud State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [cloudState, setCloudState] = useState<CloudBackupState>(loadCloudBackupState());

  // Vault Items
  const [vaultEntries, setVaultEntries] = useState<TotpEntry[]>([]);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'Favorites'>('All');

  // Modals & Navigation
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState<boolean>(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isSqliteModalOpen, setIsSqliteModalOpen] = useState<boolean>(false);
  const [inspectQrEntry, setInspectQrEntry] = useState<TotpEntry | null>(null);
  const [editEntryTarget, setEditEntryTarget] = useState<TotpEntry | null>(null);

  // System Tray minimize
  const [isMinimizedToTray, setIsMinimizedToTray] = useState<boolean>(false);

  // Clipboard auto-clear toast
  const [clipboardToast, setClipboardToast] = useState<{
    issuer: string;
    code: string;
    remainingSeconds: number;
  } | null>(null);

  // Auto-Lock Activity Tracker
  const [inactivitySeconds, setInactivitySeconds] = useState<number>(0);
  const lastActivityTimeRef = useRef<number>(Date.now());

  // Load initial settings and user auth on mount
  useEffect(() => {
    const loadedSettings = loadAppSettings();
    setSettings(loadedSettings);
    const loadedUser = loadUserAuth();
    setUser(loadedUser);
  }, []);

  // Listen for user activity to reset auto-lock timer
  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityTimeRef.current = Date.now();
      setInactivitySeconds(0);
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, []);

  // Inactivity Interval & Auto-Lock execution
  useEffect(() => {
    if (!isUnlocked || settings.autoLockMinutes === 0) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityTimeRef.current) / 1000);
      setInactivitySeconds(elapsed);

      const maxInactivitySecs = settings.autoLockMinutes * 60;
      if (elapsed >= maxInactivitySecs) {
        handleLockVault();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isUnlocked, settings.autoLockMinutes]);

  // Clipboard Auto-Clear Countdown Interval
  useEffect(() => {
    if (!clipboardToast) return;

    const timer = setInterval(() => {
      setClipboardToast((prev) => {
        if (!prev) return null;
        if (prev.remainingSeconds <= 1) {
          // Clear clipboard from memory
          try {
            navigator.clipboard.writeText('');
          } catch {
            // ignore
          }
          return null;
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [clipboardToast]);

  // Lock Vault: Memory wipe
  const handleLockVault = () => {
    if (settings.soundEffects) sounds.playLock();
    setIsUnlocked(false);
    setSessionKey(null);
    setCurrentPin('');
    setIsMinimizedToTray(false);
  };

  // Authentication Success Callback
  const handleAuthenticated = async (
    authUser: UserAuth,
    derivedKey: CryptoKey,
    pin: string
  ) => {
    setUser(authUser);
    setSessionKey(derivedKey);
    setCurrentPin(pin);
    setIsUnlocked(true);
    lastActivityTimeRef.current = Date.now();
    setInactivitySeconds(0);

    // Load decrypted vault or seed initial entries for demo
    try {
      const decrypted = await loadVaultDecrypted(derivedKey);
      if (decrypted.length > 0) {
        setVaultEntries(decrypted);
      } else {
        // Seed initial high-quality entries (Google, Cloudflare, GitHub, AWS, Microsoft)
        setVaultEntries(INITIAL_DEMO_ENTRIES);
        await saveVaultEncrypted(INITIAL_DEMO_ENTRIES, derivedKey);
      }
    } catch {
      setVaultEntries(INITIAL_DEMO_ENTRIES);
      await saveVaultEncrypted(INITIAL_DEMO_ENTRIES, derivedKey);
    }
  };

  // Persist Vault changes with active session key
  const updateVault = async (newEntries: TotpEntry[]) => {
    setVaultEntries(newEntries);
    if (sessionKey) {
      await saveVaultEncrypted(newEntries, sessionKey);
    }
  };

  // Add single entry
  const handleAddEntry = async (entry: TotpEntry) => {
    const updated = [entry, ...vaultEntries];
    await updateVault(updated);
  };

  // Add batch entries (from Google Authenticator import)
  const handleAddBatchEntries = async (batch: TotpEntry[]) => {
    const updated = [...batch, ...vaultEntries];
    await updateVault(updated);
  };

  // Delete single entry
  const handleDeleteEntry = async (id: string) => {
    const updated = vaultEntries.filter((e) => e.id !== id);
    await updateVault(updated);
  };

  // Edit single entry
  const handleSaveEditedEntry = async (updatedEntry: TotpEntry) => {
    const updated = vaultEntries.map((e) => (e.id === updatedEntry.id ? updatedEntry : e));
    await updateVault(updated);
  };

  // Toggle favorite
  const handleToggleFavorite = async (id: string) => {
    const updated = vaultEntries.map((e) =>
      e.id === id ? { ...e, isFavorite: !e.isFavorite } : e
    );
    await updateVault(updated);
  };

  // Increment HOTP counter
  const handleHotpIncrement = async (id: string) => {
    const updated = vaultEntries.map((e) =>
      e.id === id ? { ...e, counter: (e.counter || 0) + 1 } : e
    );
    await updateVault(updated);
  };

  // Copy Code to Clipboard with 30s auto-clear countdown
  const handleCodeCopied = (entry: TotpEntry, code: string) => {
    setClipboardToast({
      issuer: entry.issuer,
      code,
      remainingSeconds: settings.copyTimeoutSeconds || 30,
    });
  };

  // Filtered entries list
  const filteredEntries = useMemo(() => {
    let list = vaultEntries;

    // Category / Favorites filter
    if (selectedCategory === 'Favorites') {
      list = list.filter((e) => e.isFavorite);
    } else if (selectedCategory !== 'All') {
      list = list.filter((e) => e.category === selectedCategory);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.issuer.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q))
      );
    }

    // Sort favorites to top, then newest
    return list.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [vaultEntries, selectedCategory, searchQuery]);

  // Calculate remaining auto-lock seconds
  const autoLockRemainingSeconds =
    settings.autoLockMinutes > 0
      ? Math.max(0, settings.autoLockMinutes * 60 - inactivitySeconds)
      : null;

  // Form factor container sizing style
  const containerSizingClass = useMemo(() => {
    if (settings.viewMode === 'tablet7') {
      // 7-inch tablet aspect ratio (~600px width x 960px height)
      return 'w-full max-w-[620px] h-[92vh] max-h-[960px] rounded-xl shadow-2xl border border-zinc-800';
    }
    if (settings.viewMode === 'mobile') {
      // Mobile aspect ratio (~390px width x 844px height)
      return 'w-full max-w-[400px] h-[90vh] max-h-[844px] rounded-2xl shadow-2xl border border-zinc-800';
    }
    // Desktop Mode
    return 'w-full max-w-5xl h-[94vh] rounded-lg shadow-2xl border border-zinc-800';
  }, [settings.viewMode]);

  return (
    <div
      id="votp-root-layout"
      className="w-screen h-screen bg-[#09090b] flex items-center justify-center p-2 sm:p-3 overflow-hidden relative font-sans text-zinc-100"
    >
      {/* Subtle high-density ambient lighting */}
      <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-zinc-800/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-cyan-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Windows Window Container */}
      <main
        id="votp-app-window"
        className={`bg-[#121215] flex flex-col overflow-hidden transition-all duration-300 z-10 ${containerSizingClass} ${
          isMinimizedToTray ? 'scale-95 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
      >
        {/* Windows Standard TitleBar with 7" Tablet Sizer & Inactivity Indicator */}
        <TitleBar
          user={user}
          settings={settings}
          isUnlocked={isUnlocked}
          onLock={handleLockVault}
          onMinimizeToTray={() => setIsMinimizedToTray(true)}
          onChangeViewMode={(mode) => {
            const updated = { ...settings, viewMode: mode };
            setSettings(updated);
            saveAppSettings(updated);
          }}
          inactivityRemainingSeconds={autoLockRemainingSeconds}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenAbout={() => setIsAboutModalOpen(true)}
        />

        {/* Locked Screen or Main Authenticator Dashboard */}
        {!isUnlocked ? (
          <AuthModal
            existingUser={user}
            settings={settings}
            onAuthenticated={handleAuthenticated}
          />
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#121215]">
            {/* Top Command Toolbar */}
            <div className="p-2.5 sm:p-3 border-b border-zinc-800/90 bg-[#141418] space-y-2.5 shrink-0">
              {/* Search Bar & Action Buttons */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    id="input-totp-search"
                    placeholder="Search accounts, services, notes (e.g. Google, Cloudflare, AWS)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Add Entry (+) Button */}
                <button
                  type="button"
                  id="btn-add-entry-main"
                  onClick={() => setIsAddModalOpen(true)}
                  title="Add New 2FA Key"
                  className="py-1.5 px-3 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span className="hidden sm:inline">Add Key</span>
                </button>
              </div>

              {/* Utility Feature Bar: Google Migration, Cloud Backup, Settings, About */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5 text-xs">
                {/* Google Authenticator Migration Button */}
                <button
                  type="button"
                  id="btn-google-migration"
                  onClick={() => setIsMigrationModalOpen(true)}
                  className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <ArrowRightLeft className="w-3 h-3 text-cyan-400" />
                  <span>Google Auth Transfer</span>
                </button>

                {/* Cloud & Local Backup */}
                <button
                  type="button"
                  id="btn-cloud-backup"
                  onClick={() => setIsCloudModalOpen(true)}
                  className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <Cloud className="w-3 h-3 text-blue-400" />
                  <span>Cloud Backup</span>
                </button>

                {/* Version Tracker */}
                <button
                  type="button"
                  id="btn-version-tracker"
                  onClick={() => setIsVersionModalOpen(true)}
                  className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <GitBranch className="w-3 h-3 text-purple-400" />
                  <span>Version v1.2</span>
                </button>

                {/* Settings */}
                <button
                  type="button"
                  id="btn-settings-open"
                  onClick={() => setIsSettingsModalOpen(true)}
                  title="Settings & Auto-Lock"
                  aria-label="Settings & Auto-Lock"
                  className="p-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-100 shrink-0 transition-colors"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                </button>

                {/* About & AGPLv3 */}
                <button
                  type="button"
                  id="btn-about-open"
                  onClick={() => setIsAboutModalOpen(true)}
                  title="About VoTP & Vishal Vora"
                  aria-label="About VoTP & Vishal Vora"
                  className="p-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-100 shrink-0 transition-colors"
                >
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs">
                {(
                  [
                    'All',
                    'Favorites',
                    'Cloud',
                    'Work',
                    'Personal',
                    'Finance',
                    'Social',
                    'Other',
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                      selectedCategory === cat
                        ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                        : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    {cat === 'Favorites' && <Star className="w-2.5 h-2.5 fill-current text-amber-400" />}
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Main TOTP Cards Grid */}
            <div className="flex-1 p-2.5 sm:p-3 overflow-y-auto min-h-0 bg-[#09090b]">
              {filteredEntries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-zinc-950/60 rounded-xl border border-dashed border-zinc-800">
                  <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center mb-2.5">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xs text-zinc-200">No 2FA Keys Found</h3>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-xs">
                    {searchQuery
                      ? `No accounts matching "${searchQuery}".`
                      : 'Add your first TOTP key via manual key entry or Google Authenticator QR scan.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-3 px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add 2FA Key Now
                  </button>
                </div>
              ) : (
                <div
                  className={`grid gap-2.5 ${
                    settings.viewMode === 'desktop'
                      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-1'
                  }`}
                >
                  {filteredEntries.map((entry) => (
                    <TotpCard
                      key={entry.id}
                      entry={entry}
                      onCopy={handleCodeCopied}
                      onToggleFavorite={handleToggleFavorite}
                      onEdit={(e) => setEditEntryTarget(e)}
                      onDelete={handleDeleteEntry}
                      onViewQr={(e) => setInspectQrEntry(e)}
                      onHotpIncrement={handleHotpIncrement}
                      soundEnabled={settings.soundEffects}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer Bar: System Status & Encrypted Vault Count */}
            <footer className="px-3 py-1.5 bg-[#0d0d10] border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AES-256 Vault Active
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">{vaultEntries.length} Keys Secured</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSqliteModalOpen(true)}
                  className="hover:text-zinc-200 flex items-center gap-1 transition-colors text-zinc-400 font-mono text-[10px]"
                >
                  <FileCode2 className="w-3 h-3 text-cyan-400" />
                  ~/.votp/votp.db
                </button>
              </div>
            </footer>
          </div>
        )}
      </main>

      {/* Floating 30-Second Clipboard Auto-Clear Banner */}
      {clipboardToast && (
        <div
          id="clipboard-security-toast"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-zinc-700 shadow-2xl rounded-xl px-3.5 py-2 flex items-center gap-2.5 backdrop-blur-md animate-fadeIn"
        >
          <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
            <Check className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-xs text-zinc-100 flex items-center gap-1.5">
              <span>{clipboardToast.issuer} OTP Copied!</span>
              <span className="font-mono text-cyan-400 text-[11px]">
                ({clipboardToast.code})
              </span>
            </div>
            <div className="text-[10px] text-zinc-400">
              Auto-clearing clipboard buffer in{' '}
              <span className="font-mono text-zinc-200 font-bold">
                {clipboardToast.remainingSeconds}s
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Minimized to Tray Widget */}
      <SystemTrayWidget
        isOpen={isMinimizedToTray}
        entries={vaultEntries}
        onRestoreWindow={() => setIsMinimizedToTray(false)}
        onLock={handleLockVault}
        soundEnabled={settings.soundEffects}
      />

      {/* MODALS */}
      {/* 1. Add Entry Modal */}
      <AddEntryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddEntry={handleAddEntry}
        onAddBatchEntries={handleAddBatchEntries}
        soundEnabled={settings.soundEffects}
      />

      {/* 2. Google Authenticator Migration & Round-Trip Modal */}
      <GoogleAuthMigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
        vaultEntries={vaultEntries}
        onImportEntries={handleAddBatchEntries}
        soundEnabled={settings.soundEffects}
      />

      {/* 3. Cloud & Local Backup Modal */}
      <CloudBackupModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        vaultEntries={vaultEntries}
        cloudState={cloudState}
        onCloudStateChange={setCloudState}
        onRestoreVault={(restored) => updateVault(restored)}
        currentPin={currentPin}
        soundEnabled={settings.soundEffects}
      />

      {/* 4. Version Tracker Modal */}
      <VersionTrackerModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        repoUrl={settings.githubRepoUrl}
      />

      {/* 5. About VoTP Modal */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        onOpenMigrationSuite={() => {
          setIsAboutModalOpen(false);
          setIsMigrationModalOpen(true);
        }}
      />

      {/* 6. Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        user={user}
        currentPin={currentPin}
        onUpdatePin={(newPin, newKey) => {
          setCurrentPin(newPin);
          setSessionKey(newKey);
          saveVaultEncrypted(vaultEntries, newKey);
        }}
        onOpenSqliteInspector={() => {
          setIsSettingsModalOpen(false);
          setIsSqliteModalOpen(true);
        }}
      />

      {/* 7. SQLite Storage Inspector Modal */}
      <SQLiteInspectorModal
        isOpen={isSqliteModalOpen}
        onClose={() => setIsSqliteModalOpen(false)}
      />

      {/* 8. QR Code View Modal */}
      <QrCodeViewModal
        entry={inspectQrEntry}
        onClose={() => setInspectQrEntry(null)}
        soundEnabled={settings.soundEffects}
      />

      {/* 9. Edit Entry Modal */}
      <EditEntryModal
        entry={editEntryTarget}
        onClose={() => setEditEntryTarget(null)}
        onSave={handleSaveEditedEntry}
        soundEnabled={settings.soundEffects}
      />
    </div>
  );
}
