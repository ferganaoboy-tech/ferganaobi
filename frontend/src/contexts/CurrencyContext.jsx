import React, { createContext, useContext, useMemo } from 'react';
import { useSettings } from '../hooks/useSettings';
import { formatUZS, formatUSD, formatPrice } from '../utils/format';

const CurrencyContext = createContext(null);

/**
 * useCurrency — valyuta rejimi, formatlash va konversiya yordamchilari.
 * currencyMode: 'uzs' | 'usd' | 'hybrid'
 */
export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
};

export const CurrencyProvider = ({ children }) => {
  const { data: settingsRes } = useSettings();
  const currencyMode = settingsRes?.data?.currencyMode || 'uzs';
  const usdRate = settingsRes?.data?.usdExchangeRate || 12500;

  const value = useMemo(() => {
    const isUzs    = currencyMode === 'uzs';
    const isUsd    = currencyMode === 'usd';
    const isHybrid = currencyMode === 'hybrid';
    const SOUM = "so'\m";
    const symbol = isUsd ? '$' : isHybrid ? (SOUM + ' / $') : SOUM;
    const inputSymbol = isUsd ? '$' : SOUM;

    // so'm qiymatni rejimga qarab formatlaydi
    const fmt = (uzs) => formatPrice(uzs, currencyMode, usdRate);

    // qisqa format (mlrd, mln, ming) + valyuta belgisi
    const fmtShort = (uzs) => {
      if (uzs == null) return isUsd ? '$ 0' : ('0 ' + SOUM);
      const amount = isUsd ? (uzs / usdRate) : uzs;
      const abs = Math.abs(amount);
      let str;
      if (abs >= 1000000000) str = (amount / 1000000000).toFixed(1) + ' mlrd';
      else if (abs >= 1000000) str = (amount / 1000000).toFixed(1) + ' mln';
      else if (abs >= 1000)   str = (amount / 1000).toFixed(0) + ' ming';
      else str = String(Math.round(amount));
      return isUsd ? '$ ' + str : str + ' ' + SOUM;
    };

    // kiritilgan qiymatni so'mga o'giradi
    const toUzs = (val) => {
      const n = parseFloat(val) || 0;
      return isUsd ? Math.round(n * usdRate) : n;
    };

    // so'mni ko'rsatish uchun o'giradi
    const toDisplayValue = (uzs) => {
      if (uzs == null) return 0;
      return isUsd ? parseFloat(((uzs || 0) / usdRate).toFixed(2)) : (uzs || 0);
    };

    // mahsulotdan rejimga mos narxni oladi
    const getPriceField = (product, priceField = 'pricePerRoll') => {
      if (!product) return 0;
      if (isUsd) {
        const usdField = priceField + 'Usd';
        if (product[usdField]) return product[usdField];
        return parseFloat(((product[priceField] || 0) / usdRate).toFixed(2));
      }
      return product[priceField] || 0;
    };

    return {
      currencyMode,
      usdRate,
      isUzs,
      isUsd,
      isHybrid,
      symbol,
      inputSymbol,
      formatPrice: fmt,
      formatShortPrice: fmtShort,
      toUzs,
      toDisplayValue,
      getPriceField,
      formatUZS,
      formatUSD,
    };
  }, [currencyMode, usdRate]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export default CurrencyContext;