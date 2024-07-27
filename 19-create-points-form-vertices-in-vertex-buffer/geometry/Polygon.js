import { Vector2, Edge, Face, Mesh } from "../classes.js";

class Polygon extends Mesh {
	constructor(sides, radius) {
	
		super();
		
		// Create the outer polygon vertices
		for(let i = 0; i < sides; i++) {
			
			// Calculate the angle of each side in radians. 2 times PI is equal to circumference.
			// Divide the circumference by the number of sides to get the length of one side.
			// Then find what angle in radian each side equals to.
			// A radian is a fraction of the radius running along the circumference of the circle.
			const angle = (i * ((2 * Math.PI) / sides));
			
			// Find x and y position of the vertex. The radius is the hypothenue.
			// Using trigonometry, multiply it with cos(angle) and sin(angle) to find opposite and adjacent edge length.
			const x = radius * Math.cos(angle);
			const y = radius * Math.sin(angle);
			
			this.vertices.push(new Vector2( x, y));
		}
		
		// Create an edge between each of the polygon's outer vertices
		for (let i = 0; i < sides; i++) {
			
			const vertex1 = this.vertices[i]; // Outer vertex
			
			// Next outer vertex is equal to index + 1 but using modulo so that it wraps around. 
			// Any 'i' smaller than 'sides' will remain the same, because it is equal to modulo remainder.
			// if i + 1 is equal to sides, then modulo will yield 0. In a hexagon, this would make vertices[5] connect with vertices[0].
			const vertex2 = this.vertices[(i + 1) % sides];
			
			this.edges.push(new Edge(vertex1, vertex2));
		}
		
		// Create one vertex in the center.
		this.vertices.push(new Vector2( 0, 0 ));
		
		// Create edges linking each outer vertices to the center vertex
		for (let i = 0; i < sides; i++) {
			const vertex1 = this.vertices[sides]; // Center vertex
			const vertex2 = this.vertices[i]; // Outer vertex. Loops with modulo.
			
			this.edges.push(new Edge(vertex1, vertex2));
		}
		
		// Create faces
		for (let i = 0; i < sides; i++) {
			const vertex1 = this.vertices[sides]; // Center vertex
			const vertex2 = this.vertices[i]; // Outer vertex.
			const vertex3 = this.vertices[(i + 1) % sides]; // Next outer vertex. Loops with modulo.
			
			this.faces.push(new Face(vertex1, vertex2, vertex3));
		}
	}
}

export { Polygon };