// LexFlow · Предлоги и частицы — каркас модуля
(() => {
'use strict';
function openModule(){
  window.showScreen && window.showScreen('prepositionsScreen');
}
function close(){
  window.showScreen && window.showScreen('homeScreen');
}
function navigateBack(){
  close();
}
window.PrepositionsTrainer={open:openModule,close,navigateBack};
})();
