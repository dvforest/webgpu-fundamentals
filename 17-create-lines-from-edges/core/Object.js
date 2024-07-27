import { Vector2, Matrix3 } from "../classes.js";

class Object {
	
	constructor(){	
		this.type = "Object";
		
		this.parent = null;
		this.children = [];
		
		this.position = new Vector2();
		this.rotation = 0;
		this.scale = new Vector2(1, 1);
		
		this.localTransform = new Matrix3();
		this.worldTransform = new Matrix3();
	}
	
		// Add a children object. The parent of the children becomes the current object.
		add(object) {
			this.children.push(object);
			object.parent = this;
			return object;
		}

		// Update local and world transform matrices
		updateTransform() {
			
			// Apply current position, rotation and scale to local transform
			this.localTransform.identity()
				.rotate(this.rotation)
				.scale(this.scale)
				.translate(this.position);
			
			// Update world transform by multiplying it with parent's local transform. If no parent, copy local transform. 
			if (this.parent !== null){
				this.worldTransform = this.localTransform.multiply(this.parent.worldTransform);
			}
			else {
				this.worldTransform = this.localTransform.copy();
			}
		}
}

export { Object };