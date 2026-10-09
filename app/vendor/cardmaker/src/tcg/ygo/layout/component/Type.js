define(["react", "react-class", "draw/Group", "draw/Image", "draw/Text", "../../Icons", "../../Template"], function Type(React, ReactClass, Group, Image, Text, Icons, Template)
{
	var styles = {
		Monster: {
			fontFamily: ["ITC Stone Serif Small Caps Bold", "serif"],
			fontSize: 16,
			fontWeight: 700,
			textAlign: "left",
			whitespace: "nowrap",
			
			left: Template.monsterType.left,
			top: Template.monsterType.top,
			width: Template.monsterType.width,
			height: Template.monsterType.height
		},
		Backrow: {
			Icon:
			{
				left: 421-24-50,
				top: 77,
				width: 24,
				height: 24
			},
			Type: 
			{
				fontFamily: ["ITC Stone Serif Small Caps Bold", "serif"],
				fontSize: 19.75,
				fontWeight: 700,
				textAlign: "right",
				whitespace: "nowrap",
				
				left: 40,
				top: 75,
				width: 337,
				height: 20,
			},
			TypeWithIcon:
			{
				fontFamily: ["ITC Stone Serif Small Caps Bold", "serif"],
				fontSize: 19.75,
				fontWeight: 700,
				textAlign: "right",
				whitespace: "nowrap",
				
				left: 40,
				top: 75,
				width: 421 - 24/*width of icon*/ -50 -40 -2/*icon gap*/,
				height: 20
			},
			TypeWithIconClosing: {
			
				fontFamily: ["ITC Stone Serif Small Caps Bold", "serif"],
				fontSize: 19.75,
				fontWeight: 700,
				textAlign: "left",
				whitespace: "nowrap",
				
				left: 421-50,
				top: 75,
				width: 10,
				height: 20
			}
		}
	};
	
	// Preserve spaces inside names, but normalize punctuation from older projects.
	function compactType(value) {
		return String(value || "").trim().replace(/^\[\s*|\s*\]$/g, "").replace(/\s*\/\s*/g, "/");
	}

	var Type = ReactClass({
		render: function render()
		{
			
			var value = compactType(this.props.value);
			switch (this.props.type)
			{
			case "Backrow":
				var withIcon = [
					React.createElement(Text, {text: "[" + value, style: styles.Backrow.TypeWithIcon, key: "type"}),
					React.createElement(Image, {src: (Icons[this.props.icon]||{ url: ""}).url, style: styles.Backrow.Icon, key: "icon"}),
					React.createElement(Text, {text: "]", key: "close", style: styles.Backrow.TypeWithIconClosing })
				];
			
				return React.createElement(
					Group, 
					{
						canvas: this.props.canvas, 
						repaint: this.props.repaint 
					},
					(Icons[this.props.icon] || { url: null }).url !== null
					? withIcon 
					: React.createElement(Text, { text: "[" + value + "]", style: styles.Backrow.Type})
				);
			case "Monster":
				return React.createElement(
					Text, 
					{
						text: "[" + value + "]",
						style: styles.Monster,
						canvas: this.props.canvas,
						repaint: this.props.repaint
					}
				);
			}
			return null;
		}
	});
	Type.displayName = "Circulation";
	Type.defaultProps = {
		value: "",
		icon: "None",
		type: "Monster", // The other option is "Backrow".
	};
	return Type;
});
