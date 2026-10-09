define(["react", "react-class", "draw/Text", "../../Template"], function Effect(React, ReactClass, Text, Template)
{
	var matrix = { fontFamily: ["Matrix Book", "serif"], fontSize: 18, textAlign: "justify" };
	var styles = {
		Monster: Object.assign({}, matrix, Template.effect.monster),
		Backrow: Object.assign({}, matrix, Template.effect.backrow),
		Vanilla: Object.assign({}, matrix, Template.effect.monster, {fontFamily: ["ITC Stone Serif LT", "serif"], fontStyle: "italic"}),
		Skill: Object.assign({}, matrix, Template.effect.backrow)
	};

	var Effect = ReactClass({
		render: function render()
		{
			return React.createElement(
				Text,
				{
					text: this.props.value,
					style: Object.assign({}, styles[this.props.type]),
					repaint: this.props.repaint,
					canvas: this.props.canvas
				}
			);
		}
	});
	Effect.displayName = "Effect";
	Effect.defaultProps = {
		value: "",
		// Affects the positioning; backrow gets more room since it does not have
		// to accomodate for the ATK / DEF values among other things.
		// Pendulum effects are slightly tighter.
		type: "Monster",
		flavour: false,
	};
	return Effect;
});
