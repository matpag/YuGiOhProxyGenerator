define(["react", "react-class", "draw/Group", "draw/Text", "../../Template"], function Pendulum(React, ReactClass, Group, Text, Template)
{
	var Pendulum = ReactClass({
		render: function render()
		{
			return this.props.enabled ? React.createElement(
				Group,
				{ canvas: this.props.canvas, repaint: this.props.repaint },
				React.createElement(
					Text,
					{
						text: this.props.effect,
						style: Object.assign({fontFamily: ["Matrix Book", "serif"], fontSize: 13, textAlign: "justify"}, Template.pendulum.effect)
					}
				),
				React.createElement(
					Text,
					{
						text: this.props.blue,
						style: Object.assign({fontFamily: ["Matrix Bold Small Caps", "serif"], fontSize: 28, textAlign: "center", fontWeight: 700}, Template.pendulum.blue)
					}
				),
				React.createElement(
					Text,
					{
						text: this.props.red,
						style: Object.assign({fontFamily: ["Matrix Bold Small Caps", "serif"], fontSize: 28, textAlign: "center", fontWeight: 700}, Template.pendulum.red)
					}
				)
			) : null;
		}
	});
	Pendulum.displayName = "Pendulum";
	Pendulum.defaultProperties = {
		enabled: false,
		blue: 0,
		red: 0,
		effect: ""
	};
	return Pendulum;
});
