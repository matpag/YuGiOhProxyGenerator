define([], function FrameColor() {
    // Digital color calibration: docs/research/evidence/frame-color-profile.json.
    // Only regular frames with a consistent measured brightness excess are adjusted.
    var brightness = { Spell: 0.958, Trap: 0.908, Synchro: 0.969 };
    return {
        filter: function(layout, pendulum) {
            return !pendulum && brightness[layout] ? "brightness(" + brightness[layout] + ")" : null;
        },
        // Colored background only. Keep the outer stone border, artwork border
        // and description panel untouched. Coordinates use the Nexus canvas.
        regions: [[14,14,393,91], [14,105,28,349], [380,105,27,349],
                  [42,440,338,14], [14,454,8,131], [399,454,8,131], [14,585,393,15]]
    };
});
