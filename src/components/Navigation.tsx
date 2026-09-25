import React from 'react';
import { Mic, Sparkles, Music2, Volume2, Award, Target } from 'lucide-react';

export type ActiveTab = 'studio' | 'practice' | 'alankars' | 'tanpura' | 'taal' | 'calibrator';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isTanpuraActive: boolean;
  isTaalActive: boolean;
  isMicActive: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  isTanpuraActive,
  isTaalActive,
  isMicActive,
}) => {
  const tabs = [
    { id: 'studio' as ActiveTab, label: 'Studio (रियाज़)', icon: <Mic size={18} />, badge: isMicActive ? 'MIC ON' : undefined },
    { id: 'practice' as ActiveTab, label: 'Swara Riyaz (साधना)', icon: <Sparkles size={18} /> },
    { id: 'alankars' as ActiveTab, label: 'Alankars (अलंकार)', icon: <Award size={18} /> },
    { id: 'tanpura' as ActiveTab, label: 'Tanpura (तानपूरा)', icon: <Music2 size={18} />, badge: isTanpuraActive ? 'PLAYING' : undefined },
    { id: 'taal' as ActiveTab, label: 'Taal (ताल)', icon: <Volume2 size={18} />, badge: isTaalActive ? 'BEAT' : undefined },
    { id: 'calibrator' as ActiveTab, label: 'Scale (स्केल)', icon: <Target size={18} /> },
  ];

  return (
    <nav className="bottom-nav-bar">
      <div className="nav-container">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
            >
              <div className="nav-icon-wrap">
                {tab.icon}
                {tab.badge && <span className="nav-pulse-dot" />}
              </div>
              <span className="nav-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
