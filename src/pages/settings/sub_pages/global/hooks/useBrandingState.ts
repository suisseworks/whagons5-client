import { useState, useEffect } from 'react';
import { BrandingConfig, BrandingAssets, BrandingToggles } from '@/config/branding';
import { getPresetIdForConfig } from '../utils/themeHelpers';
import { CUSTOM_THEME_ID } from '../utils/constants';

export const useBrandingState = (
  activeBrand: BrandingConfig,
  activeAssets: BrandingAssets,
  activeToggles: BrandingToggles
) => {
  const [brand, setBrand] = useState<BrandingConfig>(() => ({ ...activeBrand }));
  const [assets, setAssets] = useState<BrandingAssets>(() => ({ ...activeAssets }));
  const [toggles, setToggles] = useState<BrandingToggles>(() => ({ ...activeToggles }));
  const [selectedTheme, setSelectedTheme] = useState<string>(() =>
    getPresetIdForConfig(activeBrand)
  );
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  useEffect(() => {
    setBrand(activeBrand);
  }, [activeBrand]);

  useEffect(() => {
    setAssets(activeAssets);
  }, [activeAssets]);

  useEffect(() => {
    setToggles(activeToggles);
  }, [activeToggles]);

  useEffect(() => {
    setSelectedTheme(getPresetIdForConfig(activeBrand));
  }, [activeBrand]);

  useEffect(() => {
    const brandingChanged = JSON.stringify(brand) !== JSON.stringify(activeBrand);
    const assetsChanged = JSON.stringify(assets) !== JSON.stringify(activeAssets);
    const togglesChanged = JSON.stringify(toggles) !== JSON.stringify(activeToggles);
    setHasPendingChanges(brandingChanged || assetsChanged || togglesChanged);
  }, [brand, assets, toggles, activeBrand, activeAssets, activeToggles]);

  const resetToActive = () => {
    setBrand(activeBrand);
    setAssets(activeAssets);
    setToggles(activeToggles);
    setSelectedTheme(getPresetIdForConfig(activeBrand));
  };

  const markAsCustom = () => {
    setSelectedTheme(CUSTOM_THEME_ID);
  };

  return {
    brand,
    setBrand,
    assets,
    setAssets,
    toggles,
    setToggles,
    selectedTheme,
    setSelectedTheme,
    hasPendingChanges,
    resetToActive,
    markAsCustom,
  };
};
