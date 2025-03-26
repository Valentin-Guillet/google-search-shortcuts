
'use strict';

let extOptions = {};

// Function to display a temporary dialog message
const displayDialog = () => {
  const dialog = document.getElementById('dialog');
  dialog.style.marginTop = '0px';

  setTimeout(() => {
    dialog.style.marginTop = '-100px';
  }, 5000);
}

const loadFormOptions = () => {
  document.getElementById('navigateWithTabs').checked = extOptions.navigateWithTabs;
  document.getElementById('navigateWithArrows').checked = extOptions.navigateWithArrows;
  document.getElementById('navigateWithJK').checked = extOptions.navigateWithJK;
  document.getElementById('styleSelectedSimple').checked = extOptions.styleSelectedSimple;
  document.getElementById('styleSelectedFancy').checked = extOptions.styleSelectedFancy;
  document.getElementById('activateSearch').checked = extOptions.activateSearch;
  document.getElementById('autoSelectFirst').checked = extOptions.autoselectFirst;
  document.getElementById('selectTextInSearchBox').checked = extOptions.selectTextInSearchbox;
  document.getElementById('addSpaceOnFocus').checked = extOptions.addSpaceOnFocus;
  document.getElementById('enableGoogleShortcuts').checked = extOptions.enableGoogleShortcuts;
};

const saveOptions = () => {
  extOptions.navigateWithTabs = document.getElementById('navigateWithTabs').checked;
  extOptions.navigateWithArrows = document.getElementById('navigateWithArrows').checked;
  extOptions.navigateWithJK = document.getElementById('navigateWithJK').checked;
  extOptions.styleSelectedSimple = document.getElementById('styleSelectedSimple').checked;
  extOptions.styleSelectedFancy = document.getElementById('styleSelectedFancy').checked;
  extOptions.activateSearch = document.getElementById('activateSearch').checked;
  extOptions.autoselectFirst = document.getElementById('autoSelectFirst').checked;
  extOptions.selectTextInSearchbox = document.getElementById('selectTextInSearchBox').checked;
  extOptions.addSpaceOnFocus = document.getElementById('addSpaceOnFocus').checked;
  extOptions.enableGoogleShortcuts = document.getElementById('enableGoogleShortcuts').checked;
  persistOptions();
};

const restoreDefaults = () => {
  extOptions = shortcuts.defaultOptions;
  persistOptions();
};

const persistOptions = () => {
  shortcuts.saveOptions(extOptions, () => {
    loadFormOptions();
    displayDialog();
  });
};

shortcuts.loadOptions(options => {
  extOptions = options;
  loadFormOptions();

  document.getElementById('save').addEventListener('click', saveOptions);
  document.getElementById('restore').addEventListener('click', restoreDefaults);
});

