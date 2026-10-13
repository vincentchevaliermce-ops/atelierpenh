// Highlights today's line in the opening hours (Phnom Penh time).
(function () {
  var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var now = new Date(Date.now() + (7 * 60 + new Date().getTimezoneOffset()) * 60000);
  var row = document.querySelector('.hours tr[data-day="' + days[now.getDay()] + '"]');
  if (row) row.className = 'today';
})();
