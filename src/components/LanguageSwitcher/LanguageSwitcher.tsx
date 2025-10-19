import { useLanguage } from '../../hooks/useLanguage';
import './LanguageSwitcher.css';

export const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as 'lv' | 'en';
    setLanguage(newLang);
  };

  return (
    <div className="language-switcher">
      <select 
        value={language} 
        onChange={handleChange}
        className="language-select"
        aria-label="Select language"
      >
        <option value="lv">🇱🇻 LV</option>
        <option value="en">🇬🇧 EN</option>
      </select>
    </div>
  );
};

