define(["react", "react-class", "draw/Text", "../../Template"], function Def(React, ReactClass, Text, Template)
{
	var style = {
		fontFamily: ["Matrix Bold Small Caps", "serif"],
		fontSize: 16,
		textAlign: "right",
		whitespace: "nowrap",
		fontWeight: 700,
		
	};
	Object.assign(style, Template.stats.def);
	var Def = ReactClass({
		render: function render()
		{
			return React.createElement(Text, { text: this.props.value, style: style, repaint: this.props.repaint, canvas: this.props.canvas })
		}
	});
	
	Def.displayName = "Def";
	Def.defaultProps = {
		type: "Regular"
	}
	return Def;
});
