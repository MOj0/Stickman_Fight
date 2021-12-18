import { vec3, quat, quat2 } from './lib/gl-matrix-module.js';

//All the joint information of an Armature (bones in a Skeleton)
class Armature
{
	constructor()
	{
		this.joints = [];
		this.orderedJoints = []; //When Bone data comes from external source like GLTF, joint index != joint number applied on vertices
	}

	loadGLTFSkin(skin)
	{
		var jName;
		for (var i = 0; i < skin.length; i++)
		{
			jName = (skin[i].name == null) ? "joint" + i :
				(skin[i].name.startsWith("Armature_")) ? skin[i].name.substring(9) : skin[i].name;

			this.addJoint(
				jName,
				skin[i].rotation,
				skin[i].position,
				skin[i].parent,
				skin[i].jointNum
			);
		}
		this.setBindPose();
		return this;
	}

	//Joints must be made in parents first then child
	//Important for updates that parent matrices get calc-ed first before children.
	addJoint(name, rot = null, pos = null, parentIdx = null, jointNum = null)
	{
		var joint = {
			jointNum: jointNum,
			index: this.joints.length,
			parent: parentIdx,
			name: name,
			isSkinned: true,
			position: vec3.create(),
			rotation: quat.create(),

			localDQ: quat2.create(),
			worldDQ: quat2.create(),
			bindPoseDQ: quat2.create(),
			offsetDQ: quat2.create()
		};

		if (pos != null) vec3.copy(joint.position, pos);
		if (rot != null) vec3.copy(joint.rotation, rot);

		this.joints.push(joint);

		//When Bone data comes from external source like GLTF, joint index != joint number applied on vertices
		if (jointNum != undefined && jointNum != null) this.orderedJoints[jointNum] = joint;
		return joint;
	}

	getJoint(name)
	{
		for (var i = 0; i < this.joints.length; i++)
		{
			if (this.joints[i].name == name) return this.joints[i];
		}
		return null;
	}

	//only call once when all bones are set where they need to be.
	setBindPose()
	{
		var b, p;

		for (var i = 0; i < this.joints.length; i++)
		{
			b = this.joints[i];										//Bone
			p = (b.parent != null) ? this.joints[b.parent] : null;	//Parent Bone

			//Calc Local matrix
			//mat4.fromQuaternionTranslation(b.localMatrix,b.rotation,b.position);

			// b.localDQ.set(b.rotation, b.position);
			quat2.fromRotationTranslation(b.localDQ, b.rotation, b.position);

			// b.position.isModified = false;
			// b.rotation.isModified = false;

			//Calculate the World Q & P
			if (p != null) quat2.mul(p.worldDQ, b.localDQ, b.worldDQ); // world = p.world * local
			else quat2.copy(b.worldDQ, b.localDQ); // no parent, local is world

			//Now we invert the world matrix which creates our bind pose,
			//a starting point to check for changes in the world matrix
			//mat4.invert(b.bindPoseMatrix,b.worldMatrix);
			quat2.invert(b.worldDQ, b.bindPoseDQ);
		}
	}

	update() //calc all the bone positions
	{
		var b, p;
		for (var i = 0; i < this.joints.length; i++)
		{
			b = this.joints[i];			//Bone
			p = (b.parent != null) ? this.joints[b.parent] : null;	//Parent Joint

			quat2.fromRotationTranslation(b.localDQ, b.rotation, b.position);
			//console.log(i,b.name,b.parent);
			if (p != null) quat2.mul(p.worldDQ, b.localDQ, b.worldDQ); // world = p.world * local
			else quat2.copy(b.worldDQ, b.localDQ); // no parent, local is world

			//Calc the difference from the bindPose
			quat2.mul(b.worldDQ,b.bindPoseDQ, b.offsetDQ); // world = p.world * local
		}
	}

	getFlatOffset(out) //Used for Vertices to move
	{
		var b, j,
			bAry = (this.orderedJoints.length > 0) ? this.orderedJoints : this.joints;

		for (var i = 0; i < bAry.length; i++)
		{
			b = bAry[i].offsetDQ;
			out.push(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]);
		}
	}

	//Used by ArmatureRenderer for visualizing bones
	getFlatWorldSpace(out)
	{ 
		var b;
		for (var i = 0; i < this.joints.length; i++)
		{
			b = this.joints[i].worldDQ;
			out.push(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]);
		}
	}
}


// //Renderer object to be able to visually see the Armature Data.
// class ArmatureRenderer extends Renderable
// {
// 	constructor(arm, matName, jointLen = 3.0)
// 	{
// 		super(null, matName);

// 		this.armature = arm;
// 		this.drawMode = gl.ctx.LINES;
// 		this.useDepthTest = false;

// 		var verts = [0, 0, 0, 0, 0, jointLen, 0, 1],
// 			offset = [];

// 		this.armature.getFlatWorldSpace(offset);
// 		//console.log(offset);

// 		this.vao = VAO.create();
// 		VAO.floatArrayBuffer(this.vao, "bVertices", verts, ATTR_POSITION_LOC, 4, 0, 0, true)
// 			.floatArrayBuffer(this.vao, "bOffset", offset, 8, 4, 32, 0, true, true)	//QR (Rotation)
// 			.partitionFloatBuffer(9, 4, 32, 16, true) 									//QD (Translation)
// 			.finalize(this.vao);

// 		this.instanceSize = offset.length / 8; //How many bones are we rendering
// 		//console.log(this.instanceSize);
// 		//console.log(this.vao);
// 	}

// 	updateOffset()
// 	{
// 		var offset = [];
// 		this.armature.getFlatWorldSpace(offset);
// 		//console.log("x",offset);
// 		//TODO Only Update if dirty;

// 		gl.ctx.bindBuffer(gl.ctx.ARRAY_BUFFER, this.vao.bOffset.ptr);
// 		gl.ctx.bufferSubData(gl.ctx.ARRAY_BUFFER, 0, new Float32Array(offset), 0, null);
// 		gl.ctx.bindBuffer(gl.ctx.ARRAY_BUFFER, null);
// 	}

// 	draw()
// 	{
// 		if (this.vao.count > 0)
// 		{
// 			this.updateOffset();
// 			//console.log(this.vao.buffers["offset"].buf);

// 			gl.ctx.bindVertexArray(this.vao.ptr);
// 			gl.ctx.drawArraysInstanced(this.drawMode, 0, this.vao.count, this.instanceSize);

// 			//if(this.vao.isIndexed)	gl.ctx.drawElements(this.drawMode, this.vao.count, Fungi.gl.UNSIGNED_SHORT, 0); 
// 			//else 					gl.ctx.drawArrays(this.drawMode, 0, this.vao.count);
// 		}
// 	}
// }

// export { Armature, ArmatureRenderer };
export { Armature };