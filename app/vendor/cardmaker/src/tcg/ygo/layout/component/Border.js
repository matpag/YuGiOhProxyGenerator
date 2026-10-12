define(["react", "react-class", "draw/Image", "../../Resources", "../../Template", "../../FrameColor"], function Border(React, ReactClass, Image, resources, Template, FrameColor)
{
	var Border = ReactClass({
		render: function render()
		{
			var special = { Slifer: "slifer", Obelisk: "obelisk", Ra: "ra" }[this.props.value];
			var frame = special || this.props.value;
			if (this.props.pendulum && !special)
			{
				frame += ".pendulum";
			}
			var border = resources + "/../frames/" + frame + ".png" + (special ? "?v=3" : "");
			return React.createElement(Image, { 
				src: border,
                canvasFilter: FrameColor.filter(this.props.value, this.props.pendulum),
                canvasFilterRegions: FrameColor.regions, 
				style: {
					left: 0,
					top: 0,
					width: Template.width,
					height: Template.height
				},
				canvas: this.props.canvas, 
				repaint: this.props.repaint 
			});
		}
	});
	Border.displayName = "Border";
	Border.defaultProps = {
		value: "Normal"
	};
	return Border;
});
