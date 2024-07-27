import { Object } from "../core/Object.js";

class Mesh extends Object {
	constructor(){
		
		super();
		
		this.type = "Mesh";
		this.isActive = false;
		this.isTranslated = false;
		
		this.vertices = [];
		this.edges = [];
		this.faces = [];

		// Vertex and edge style
		this.vertexWidth = 4;
		this.edgeWidth = 1;
		this.color = "";
		this.activeColor = "red";
		this.inactiveColor = "white";
	}
	
	moveVertices(vertices, updated_positions){
	
		for(let i = 0; i < vertices.length; i++){
			this.vertices[vertices[i]].set(updated_positions[i].x, updated_positions[i].y);
		}
	}

	// Draw the mesh with vertices as dots and edges as lines.
	draw(ctx){

		//Update color if active
		if (this.isActive){
			this.color = this.activeColor;
		}
		else{
			this.color = this.inactiveColor;
		}

		// Draw vertices
		for(let i = 0; i < this.vertices.length; i++){

			// Apply mesh transforms
			const vertex = this.vertices[i].copy().applyMatrix3(this.worldTransform);
			const [x, y] = [vertex.x, vertex.y];
			const vw = this.vertexWidth;

			// Draw square at each vertex position, centered.
			ctx.fillStyle = this.color;
			ctx.fillRect( 	x - vw / 2,
						  	y - vw / 2,
							vw,
							vw);
		}

		// Draw edges
		for(let i = 0; i < this.edges.length; i++){
			// Apply mesh transforms
			const e = this.edges[i];
			const v1 = e.vertex1.copy().applyMatrix3(this.worldTransform);
			const v2 = e.vertex2.copy().applyMatrix3(this.worldTransform);
			
			ctx.beginPath();
			ctx.moveTo(v1.x, v1.y);
			ctx.lineTo(v2.x, v2.y);
			ctx.strokeStyle = this.color;
			ctx.lineWidth = this.edgeWidth;
			ctx.stroke();
		}
	}
	
	// Loops through every face to find if a given point is inside the mesh. Returns true or false.
	isPointInside(point){
		let isInside = false;
		
		for (const face of this.faces){
			if (face.isPointInside(point, this.worldTransform)){
				isInside = true;
				break;
			}
		}
		
		return isInside;
	}
}

export { Mesh };