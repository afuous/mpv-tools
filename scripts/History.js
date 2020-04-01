var SelectionMenu = require("SelectionMenu");

var menu = new SelectionMenu({
    maxLines: 10,
    menuFontSize: 40,
    autoCloseDelay: 5, // -1 ? i guess this is supposed to be configurable actually
    keyRebindings: {
        'Menu-Up': ['up'],
        'Menu-Down': ['down'],
        'Menu-Up-Fast': ['shift+up'],
        'Menu-Down-Fast': ['shift+down'],
        'Menu-Left': ['left'],
        'Menu-Right': ['right'],
        'Menu-Open': ['enter'],
        'Menu-Undo': ['bs'],
        'Menu-Help': ['h'],
        'Menu-Close': ['esc'],
    },
});

menu.setUseTextColors(mp.get_property_bool('vo-configured'));
mp.observe_property('vo-configured', 'bool', function(name, value) {
    menu.setUseTextColors(value);
});


// https://old.reddit.com/r/linuxquestions/comments/3t6s7k/mpv_history_of_recently_played_media/


function modifyWithLock(file, lockfile, modify) {
    function readIfExists(f) {
        try {
            return mp.utils.read_file(f);
        } catch (e) {
            return "";
        }
    }
    function loop() {
        if (readIfExists(lockfile).length != 0) {
            setTimeout(loop, 100);
            return;
        }
        var key = mp.utils.getpid() + " " + Math.random();
        mp.utils.write_file("file://" + lockfile, key);
        setTimeout(function() {
            if (readIfExists(lockfile) == key) {
                mp.utils.write_file("file://" + file, modify(readIfExists(file)));
                mp.utils.write_file("file://" + lockfile, "");
            } else {
                setTimeout(loop, 100);
            }
        }, 100);
    }
    loop();
}

var configPath = (function() {
    var scriptFile = mp.get_script_file();
    var index = scriptFile.indexOf("/scripts/");
    if (index == -1) {
        return "~/.config/mpv";
    }
    return scriptFile.slice(0, index);
})();
var historyFile = configPath + "/history.log";
var lockFile = "/tmp/mpvhistorylock";

function parseHistoryString(historyString) {
    var lines = historyString.split("\n");
    if (lines.length > 0 && lines[lines.length - 1].length == 0) {
        // ignore trailing empty line that split() creates
        lines.splice(lines.length - 1, 1);
    }
    if (lines.length % 2 == 1) {
        // ignore last line if odd number of lines
        lines.splice(lines.length - 1, 1);
    }
    return lines;
}

mp.register_event("file-loaded", function() {
    // does not capture cookies or other http headers
    // unsure if possible to read these, or load a file with these without restarting mpv
    // if it is possible, would need log file to be in json format or something

    var path = mp.get_property("path");
    if (!path.match(/^[a-zA-Z]+:\/\//)) {
        path = mp.utils.join_path(mp.get_property("working-directory"), path);
    }

    var name;
    if (path.match(/^https?:\/\//) && !path.match(/^https?:\/\/([a-zA-Z0-9\-]\.)*youtube.com\//)) {
        // non youtube http streaming
        // ignoring querystring and trailing slashes, take the decoded url after the last slash
        var qsStart = path.indexOf("?");
        if (qsStart == -1) {
            qsStart = path.length;
        }
        while (path[qsStart - 1] == "/") {
            qsStart--;
        }
        var lastSlash = path.slice(0, qsStart).lastIndexOf("/"); // should never be -1
        name = decodeURIComponent(path.slice(lastSlash + 1, qsStart));
    } else if (path.match(/^[a-zA-Z]:\/\//)) {
        // everything else except local files
        name = mp.get_property("media-title");
    } else {
        // local files
        name = path.slice(path.lastIndexOf("/") + 1);
    }

    modifyWithLock(historyFile, lockFile, function(historyString) {
        var lines = parseHistoryString(historyString);
        var result = name + "\n" + path + "\n";
        for (var i = 0; i < lines.length / 2; i++) {
            if (lines[i * 2 + 1] != path) {
                // only keep old record if it is not the same as the new one
                result += lines[i * 2] + "\n" + lines[i * 2 + 1] + "\n";
            }
        }
        return result;
    });
});

var names;
var paths;

menu.setCallbackMenuOpen(function() {
    mp.commandv("loadfile", paths[menu.selectionIdx]);
    menu.hideMenu();
});

// delete a history entry by pressing left arrow on it
menu.setCallbackMenuLeft(function() {
    if (paths.length == 0) {
        return;
    }

    var index = menu.selectionIdx;

    // need to search for the path in case history file was changed since opening the menu
    var path = paths[index];

    // do this first since obtaining a lock requires a delay
    names.splice(index, 1);
    paths.splice(index, 1);
    menu.setOptions(names);
    menu.renderMenu();

    modifyWithLock(historyFile, lockFile, function(historyString) {
        var lines = parseHistoryString(historyString);
        var result = "";
        for (var i = 0; i < lines.length / 2; i++) {
            if (lines[i * 2 + 1] != path) {
                result += lines[i * 2] + "\n" + lines[i * 2 + 1] + "\n";
            }
        }
        return result;
    });
});

mp.add_key_binding(null, "History", function() {
    var historyString = "";
    try {
        historyString = mp.utils.read_file(historyFile);
    } catch (e) {}
    var lines = parseHistoryString(historyString);
    names = [];
    paths = [];
    for (var i = 0; i < lines.length / 2; i++) {
        names[i] = lines[i * 2];
        paths[i] = lines[i * 2 + 1];
    }
    menu.setOptions(names, 0);
    menu.setTitle("History");
    menu.renderMenu();
});
