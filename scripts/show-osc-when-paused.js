// taken straight from here
// https://github.com/mpv-player/mpv/issues/6592#issuecomment-626304300

mp.observe_property("pause", "bool", function(_, paused) {
    if (paused) {
        mp.command("no-osd set osd-level 0; script-message osc-visibility always");
        setTimeout(function() {
            mp.command("no-osd set osd-level 1");
        }, 1000);
    } else {
        mp.command("no-osd set osd-level 0; script-message osc-visibility auto");
        setTimeout(function() {
            mp.command("no-osd set osd-level 1");
        }, 1000);
    }
});
