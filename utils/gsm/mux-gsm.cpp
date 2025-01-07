#include "RadioMessage.h"
#include "stdio.h"
#include <cstdint>
#include <iostream>
#include <ctime>

// must be less than GSData::maxSize
#define PACKET_SIZE 100

// on Windows build in MinGW

// TODO: add to build system
// build instructions:
// mkdir build && cd build
// cmake ..
// make

// TODO: develop abstraction for input data
const char video1File[] = "video0.av1";
const char video2File[] = "video1.av1";
const char outFile[] = "out.gsm";

int main(int argc, char const *argv[])
{
    APRSConfig c = {"KC3UTM", "ALL", "WIDE1-1", PositionWithoutTimestampWithoutAPRS, '\\', 'M'};
    double orientTest[3] = {1.0, 110.0, 65.0};
    APRSTelem telemData(c, 39.336896667, -77.337067833, 480.0, 0.0, 31.0, orientTest, (uint32_t)0x15abcdef);
    Message telem;
    VideoData video1Data;
    VideoData video2Data;
    Message video1;
    Message video2;
    GSData muxTelemOut(APRSTelem::type, 1, 1);
    GSData muxVideo1Out(VideoData::type, 2, 2);
    GSData muxVideo2Out(VideoData::type, 3, 3);
    Metrics device1Metrics(1);
    Metrics device2Metrics(2);
    Metrics device3Metrics(3);

    int telemFrequency = 1; // transmissions / second

    telem.encode(&telemData);

    int video1Bitrate = 250e3;                                         // bits / second
    int video2Bitrate = 250e3;                                         // bits / second
    int telemBitrate = strlen((char *)telem.buf) * 8 * telemFrequency; // bits / second
    int totalBitrate = video1Bitrate + video2Bitrate + telemBitrate;
    double video1Fraction = (double)video1Bitrate / totalBitrate;
    double video2Fraction = (double)video2Bitrate / totalBitrate;
    double telemFraction = (double)telemBitrate / totalBitrate;

    double video1TXSize = PACKET_SIZE;
    double video2TXSize = video1TXSize * video2Fraction / video1Fraction;
    double telemTXSize = video1TXSize * telemFraction / video1Fraction;

    printf("%d, %d, %d, %d\n", video1Bitrate, video2Bitrate, telemBitrate, totalBitrate);
    printf("%lf, %lf, %lf\n", video1Fraction, video2Fraction, telemFraction);
    printf("%lf, %lf, %lf\n", video1TXSize, video2TXSize, telemTXSize);

    int video1MessageFrequency = 0;
    int video2MessageFrequency = 0;
    int telemMessageFrequency = 0;
    // truncate sizes to ints
    int video1TrueSize = video1TXSize;
    int video2TrueSize = video2TXSize;
    int telemTrueSize = telemTXSize;

    if (video1TXSize < 1)
    {
        video1MessageFrequency = 1 / video1TXSize;
        video1TrueSize = video1Bitrate / 8; // transmit the entire message in one go since it is insignificant compared to other bitrates
    }
    if (video2TXSize < 1)
    {
        video2MessageFrequency = 1 / video2TXSize;
        video2TrueSize = video2Bitrate / 8;
    }
    if (telemTXSize < 1)
    {
        telemMessageFrequency = totalBitrate / (8 * (video1TrueSize + video2TrueSize));
        telemTrueSize = telemBitrate / 8;
    }

    printf("%d, %d, %d\n", video1MessageFrequency, video2MessageFrequency, telemMessageFrequency); // this needs to be generalized
    printf("%d, %d, %d\n", video1TrueSize, video2TrueSize, telemTrueSize);

    int video1Counter = 0;
    int video2Counter = 0;
    int telemCounter = 0;

    FILE *out = fopen(outFile, "wb");

    FILE *file1 = fopen(video1File, "rb");
    FILE *file2 = fopen(video2File, "rb");

    if (!out)
    {
        std::cerr << "Error opening output file!" << std::endl;
        return 1;
    }
    if (!file1)
    {
        std::cerr << "Error opening first video file!" << std::endl;
        return 1;
    }
    if (!file2)
    {
        std::cerr << "Error opening second video file!" << std::endl;
        return 1;
    }

    // write GSM header
    char gsmHeader[GSData::gsmHeaderSize] = {0};
    GSData::encodeGSMHeader(gsmHeader, GSData::gsmHeaderSize, totalBitrate);
    fwrite(gsmHeader, sizeof(char), GSData::gsmHeaderSize, out);

    muxTelemOut.fill(telem.buf, telem.size);
    telem.encode(&muxTelemOut);

    char buf[100];

    // setup metrics to start logging bitrate
    device1Metrics.setInitialTime(clock());
    device2Metrics.setInitialTime(clock());
    device3Metrics.setInitialTime(clock());

    while (feof(file1) == 0 || feof(file2) == 0)
    {
        if (video1MessageFrequency == 0 && feof(file1) == 0)
        {
            // write video1
            int readBytes = fread(buf, sizeof(char), PACKET_SIZE, file1);
            muxVideo1Out.fill((uint8_t *)buf, readBytes);
            video1.encode(&muxVideo1Out);
            fwrite(video1.buf, sizeof(char), video1.size, out);
            device1Metrics.updateBitrate(video1.size * 8, clock());
        }
        if (video2MessageFrequency == 0 && feof(file2) == 0)
        {
            // write video2
            int readBytes = fread(buf, sizeof(char), PACKET_SIZE, file2);
            muxVideo2Out.fill((uint8_t *)buf, readBytes);
            video2.encode(&muxVideo2Out);
            fwrite(video2.buf, sizeof(char), video2.size, out);
            device2Metrics.updateBitrate(video2.size * 8, clock());
        }
        if (telemMessageFrequency == 0)
        {
            // write telem
            // TODO (not currently used)
        }

        if (video1MessageFrequency > 0 && video1Counter == video1MessageFrequency)
        {
            video1Counter = 0;
            // write video1
            // TODO (not currently used)
        }
        if (video2MessageFrequency > 0 && video2Counter == video2MessageFrequency)
        {
            video2Counter = 0;
            // write video2
            // TODO (not currently used)
        }
        if (telemMessageFrequency > 0 && telemCounter == telemMessageFrequency)
        {
            telemCounter = 0;
            // write telem
            fwrite(telem.buf, sizeof(char), telem.size, out);
            device3Metrics.updateBitrate(telem.size * 8, clock());
        }

        if (video1MessageFrequency > 0)
            video1Counter++;
        if (video2MessageFrequency > 0)
            video2Counter++;
        if (telemMessageFrequency > 0)
            telemCounter++;
    }

    printf("finished\n");
    printf("%ld, %ld, %ld\n", device1Metrics.averageBitrate, device2Metrics.averageBitrate, device3Metrics.averageBitrate);

    // uint32_t decodedBitrate = 0;
    // bool success = GSData::decodeGSMHeader(gsmHeader, GSData::gsmHeaderSize, decodedBitrate);
    // if (success)
    // {
    //     printf("successfully decoded gsm header\n");
    //     printf("bitrate: %d\n", decodedBitrate);
    // }
    // else
    // {
    //     printf("failed to decode gsm header\n");
    // }

    fclose(out);
    fclose(file1);
    fclose(file2);

    return 0;
}
