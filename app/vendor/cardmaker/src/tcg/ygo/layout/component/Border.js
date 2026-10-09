define(["react", "react-class", "draw/Image", "../../Resources", "../../Template", "../../FrameColor"], function Border(React, ReactClass, Image, resources, Template, FrameColor)
{
	var Border = ReactClass({
		render: function render()
		{
			var border = resources + "/tcg/ygo/border/" + this.props.value + ".png";
			if (this.props.pendulum)
			{
				border = border.replace(".png", ".pendulum.png");
			}
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
