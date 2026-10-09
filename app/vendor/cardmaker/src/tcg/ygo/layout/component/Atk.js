define(["react", "react-class", "draw/Text", "../../Template"], function Atk(React, ReactClass, Text, Template)
{
	var style = {
		fontFamily: ["Matrix Bold Small Caps", "serif"],
		fontSize: 16,
		textAlign: "right",
		whitespace: "nowrap",
		fontWeight: 700,
		
	};
	Object.assign(style, Template.stats.atk);
	var Atk = ReactClass({
		render: function render()
		{
			return React.createElement(Text, { text: this.props.value, style: style, repaint: this.props.repaint, canvas: this.props.canvas })
		}
	});
	
	Atk.displayName = "Atk";
	Atk.defaultProps = {
		
	}
	return Atk;
});
