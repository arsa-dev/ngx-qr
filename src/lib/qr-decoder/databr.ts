/*
  Ported to JavaScript by Lazar Laszlo 2011

  lazarsoft@gmail.com, www.lazarsoft.info

*/

/*
 *
 * Copyright 2007 ZXing authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export class QRCodeDataBlockReader {
	constructor(blocks: any, version: any, numErrorCorrectionCode: any) {
		this.blocks = blocks;
		this.numErrorCorrectionCode = numErrorCorrectionCode;
		if (version <= 9) {
			this.dataLengthMode = 0;
		} else if (version >= 10 && version <= 26) {
			this.dataLengthMode = 1;
		} else if (version >= 27 && version <= 40) {
			this.dataLengthMode = 2;
		}
	}

	get DataByte(): any {
		const output = new Array();
		const MODE_NUMBER = 1;
		const MODE_ROMAN_AND_NUMBER = 2;
		const MODE_8BIT_BYTE = 4;
		const MODE_ECI = 7;
		const MODE_KANJI = 8;
		do {
			const mode = this.NextMode();
			// canvas.println("mode: " + mode);
			if (mode == 0) {
				if (output.length > 0) {
					break;
				} else {
					throw new Error("Empty data block");
				}
			}
			// if (mode != 1 && mode != 2 && mode != 4 && mode != 8)
			// 	break;
			// }
			if (mode != MODE_NUMBER && mode != MODE_ROMAN_AND_NUMBER && mode != MODE_8BIT_BYTE && mode != MODE_KANJI && mode != MODE_ECI) {
				/*					canvas.println("Invalid mode: " + mode);
						 mode = guessMode(mode);
						 canvas.println("Guessed mode: " + mode); */
				throw new Error("Invalid mode: " + mode + " in (block:" + this.blockPointer + " bit:" + this.bitPointer + ")");
			}

			if (mode == MODE_ECI) {
				var temp_sbyteArray3 = this.parseECIValue();
				//output.push(temp_sbyteArray3);
			} else {
				const dataLength = this.getDataLength(mode);
				if (dataLength < 1) {
					throw new Error("Invalid data length: " + dataLength);
				}
				// canvas.println("length: " + dataLength);
				switch (mode) {
					case MODE_NUMBER:
						// canvas.println("Mode: Figure");
						const temp_str1 = this.getFigureString(dataLength);
						let ta1 = new Array(temp_str1.length);
						for (let j = 0; j < temp_str1.length; j++) {
							ta1[j] = temp_str1.charCodeAt(j);
						}
						output.push(ta1);
						break;

					case MODE_ROMAN_AND_NUMBER:
						// canvas.println("Mode: Roman&Figure");
						const temp_str2 = this.getRomanAndFigureString(dataLength);
						const ta = new Array(temp_str2.length);
						for (let j = 0; j < temp_str2.length; j++) {
							ta[j] = temp_str2.charCodeAt(j);
						}
						output.push(ta);
						// output.Write(SystemUtils.ToByteArray(temp_sbyteArray2), 0, temp_sbyteArray2.Length);
						break;

					case MODE_8BIT_BYTE:
						// canvas.println("Mode: 8bit Byte");
						// sbyte[] temp_sbyteArray3;
						const temp_sbyteArray3 = this.get8bitByteArray(dataLength);
						output.push(temp_sbyteArray3);
						// output.Write(SystemUtils.ToByteArray(temp_sbyteArray3), 0, temp_sbyteArray3.Length);
						break;

					case MODE_KANJI:
						// canvas.println("Mode: Kanji");
						// sbyte[] temp_sbyteArray4;
						// temp_sbyteArray4 = SystemUtils.ToSByteArray(SystemUtils.ToByteArray(getKanjiString(dataLength)));
						// output.Write(SystemUtils.ToByteArray(temp_sbyteArray4), 0, temp_sbyteArray4.Length);
						const temp_str = this.getKanjiString(dataLength);
						output.push(temp_str);
						break;
				}
			}
			//
			// canvas.println("DataLength: " + dataLength);
			// Console.out.println(dataString);
		} while (true);
		return output;
	}
	static sizeOfDataLengthInfo = [
		[10, 9, 8, 8],
		[12, 11, 16, 10],
		[14, 13, 16, 12],
	];
	blockPointer = 0;
	bitPointer = 7;
	dataLength = 0;
	blocks: any;
	numErrorCorrectionCode: any;
	dataLengthMode: number;

	parseECIValue() {
		var intData = 0;
		var firstByte = this.getNextBits(8);
		if ((firstByte & 0x80) == 0) {
			intData = firstByte & 0x7f;
		}
		if ((firstByte & 0xc0) == 0x80) {
			// two bytes
			var secondByte = this.getNextBits(8);
			intData = ((firstByte & 0x3f) << 8) | secondByte;
		}
		if ((firstByte & 0xe0) == 0xc0) {
			// three bytes
			var secondThirdBytes = this.getNextBits(8);
			intData = ((firstByte & 0x1f) << 16) | secondThirdBytes;
		}
		return intData;
	}

	getNextBits(numBits: any): any {
		let bits = 0;
		if (numBits < this.bitPointer + 1) {
			// next word fits into current data block
			let mask = 0;
			for (let i = 0; i < numBits; i++) {
				mask += 1 << i;
			}
			mask <<= this.bitPointer - numBits + 1;

			bits = (this.blocks[this.blockPointer] & mask) >> (this.bitPointer - numBits + 1);
			this.bitPointer -= numBits;
			return bits;
		} else if (numBits < this.bitPointer + 1 + 8) {
			// next word crosses 2 data blocks
			let mask1 = 0;
			for (let i = 0; i < this.bitPointer + 1; i++) {
				mask1 += 1 << i;
			}
			bits = (this.blocks[this.blockPointer] & mask1) << (numBits - (this.bitPointer + 1));
			this.blockPointer++;
			bits += this.blocks[this.blockPointer] >> (8 - (numBits - (this.bitPointer + 1)));

			this.bitPointer = this.bitPointer - (numBits % 8);
			if (this.bitPointer < 0) {
				this.bitPointer = 8 + this.bitPointer;
			}
			return bits;
		} else if (numBits < this.bitPointer + 1 + 16) {
			// next word crosses 3 data blocks
			let mask1 = 0; // mask of first block
			let mask3 = 0; // mask of 3rd block
			// bitPointer + 1 : number of bits of the 1st block
			// 8 : number of the 2nd block (note that use already 8bits because next word uses 3 data blocks)
			// numBits - (bitPointer + 1 + 8) : number of bits of the 3rd block
			for (let i = 0; i < this.bitPointer + 1; i++) {
				mask1 += 1 << i;
			}
			const bitsFirstBlock = (this.blocks[this.blockPointer] & mask1) << (numBits - (this.bitPointer + 1));
			this.blockPointer++;

			const bitsSecondBlock = this.blocks[this.blockPointer] << (numBits - (this.bitPointer + 1 + 8));
			this.blockPointer++;

			for (let i = 0; i < numBits - (this.bitPointer + 1 + 8); i++) {
				mask3 += 1 << i;
			}
			mask3 <<= 8 - (numBits - (this.bitPointer + 1 + 8));
			const bitsThirdBlock = (this.blocks[this.blockPointer] & mask3) >> (8 - (numBits - (this.bitPointer + 1 + 8)));

			bits = bitsFirstBlock + bitsSecondBlock + bitsThirdBlock;
			this.bitPointer = this.bitPointer - ((numBits - 8) % 8);
			if (this.bitPointer < 0) {
				this.bitPointer = 8 + this.bitPointer;
			}
			return bits;
		} else {
			return 0;
		}
	}
	NextMode(): any {
		if (this.blockPointer > this.blocks.length - this.numErrorCorrectionCode - 2) {
			return 0;
		} else {
			return this.getNextBits(4);
		}
	}
	getDataLength(modeIndicator: any): any {
		let index = 0;
		while (true) {
			if (modeIndicator >> index == 1) {
				break;
			}
			index++;
		}

		return this.getNextBits(QRCodeDataBlockReader.sizeOfDataLengthInfo[this.dataLengthMode][index]);
	}
	getRomanAndFigureString(dataLength: any): any {
		let length = dataLength;
		let intData = 0;
		let strData = "";
		const tableRomanAndFigure = new Array(
			"0",
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9",
			"A",
			"B",
			"C",
			"D",
			"E",
			"F",
			"G",
			"H",
			"I",
			"J",
			"K",
			"L",
			"M",
			"N",
			"O",
			"P",
			"Q",
			"R",
			"S",
			"T",
			"U",
			"V",
			"W",
			"X",
			"Y",
			"Z",
			" ",
			"$",
			"%",
			"*",
			"+",
			"-",
			".",
			"/",
			":"
		);
		do {
			if (length > 1) {
				intData = this.getNextBits(11);
				const firstLetter = Math.floor(intData / 45);
				const secondLetter = intData % 45;
				strData += tableRomanAndFigure[firstLetter];
				strData += tableRomanAndFigure[secondLetter];
				length -= 2;
			} else if (length == 1) {
				intData = this.getNextBits(6);
				strData += tableRomanAndFigure[intData];
				length -= 1;
			}
		} while (length > 0);

		return strData;
	}
	getFigureString(dataLength: any): any {
		let length = dataLength;
		let intData = 0;
		let strData = "";
		do {
			if (length >= 3) {
				intData = this.getNextBits(10);
				if (intData < 100) {
					strData += "0";
				}
				if (intData < 10) {
					strData += "0";
				}
				length -= 3;
			} else if (length == 2) {
				intData = this.getNextBits(7);
				if (intData < 10) {
					strData += "0";
				}
				length -= 2;
			} else if (length == 1) {
				intData = this.getNextBits(4);
				length -= 1;
			}
			strData += intData;
		} while (length > 0);

		return strData;
	}
	get8bitByteArray(dataLength: any): any {
		let length = dataLength;
		let intData = 0;
		const output = new Array();

		do {
			intData = this.getNextBits(8);
			output.push(intData);
			length--;
		} while (length > 0);
		return output;
	}
	getKanjiString(dataLength: any): any {
		let length = dataLength;
		let intData = 0;
		let unicodeString = "";
		do {
			intData = this.getNextBits(13);
			const lowerByte = intData % 0xc0;
			const higherByte = intData / 0xc0;

			const tempWord = (higherByte << 8) + lowerByte;
			let shiftjisWord = 0;
			if (tempWord + 0x8140 <= 0x9ffc) {
				// between 8140 - 9FFC on Shift_JIS character set
				shiftjisWord = tempWord + 0x8140;
			} else {
				// between E040 - EBBF on Shift_JIS character set
				shiftjisWord = tempWord + 0xc140;
			}

			// var tempByte = new Array(0,0);
			// tempByte[0] = (sbyte) (shiftjisWord >> 8);
			// tempByte[1] = (sbyte) (shiftjisWord & 0xFF);
			// unicodeString += new String(SystemUtils.ToCharArray(SystemUtils.ToByteArray(tempByte)));
			unicodeString += String.fromCharCode(shiftjisWord);
			length--;
		} while (length > 0);

		return unicodeString;
	}
}
