#include "SerialPort.hpp"
#include <iostream>
#include <string>

char portPrefix[] = "\\\\.\\COM14";


int main(int argc, char **argv) {

    SerialPort teensy(portPrefix);
    size_t x;
    size_t dataidx;
    byte data[MAX_DATA_LENGTH];

    // if(teensy.isConnected()){
	// 	std::cout<<"Connection made"<<std::endl<<std::endl;
	// }
	// else{
	// 	std::cout<<"Error in port name"<<std::endl<<std::endl;
	// }

    while(!teensy.isConnected()) {
        Sleep(10);
    }

    while (teensy.isConnected()) {
        x = teensy.readSerialPort(data, MAX_DATA_LENGTH);
        // Sleep(500);
        // std::cout << data;
        // !WriteFile(hPipe1, data, MAX_DATA_LENGTH, &dwWritten, NULL);


        // implement demuxer on data
        dataidx = 0;  // index of the next byte to read from data (so we don't need to always resize it)

        // repeat until we have processed all data
        while (dataidx < x) {
            std::cout << data[dataidx];
            dataidx++;
        }
    }

    return 0;
}