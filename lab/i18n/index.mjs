import * as en from "./en.mjs";
import * as ko from "./ko.mjs";

const catalogs = Object.freeze({ en, ko });

export function createTranslator(requestedLocale) {
  const selected = catalogs[requestedLocale] ?? catalogs.en;
  return function translate(key, values = {}) {
    const template = selected.messages[key];
    if (typeof template !== "string") throw new TypeError(`missing i18n message: ${key}`);
    return template.replace(/\{([a-z][a-zA-Z0-9]*)\}/g, (match, name) => (
      Object.hasOwn(values, name) ? String(values[name]) : match
    ));
  };
}

export function documentLocale(documentElement = document.documentElement) {
  return documentElement.lang === "ko" ? "ko" : "en";
}
