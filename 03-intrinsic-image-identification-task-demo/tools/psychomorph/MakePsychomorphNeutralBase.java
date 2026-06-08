import Facemorph.ASM;
import Facemorph.Template;
import Facemorph.Warp;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Point2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.ArrayList;
import javax.imageio.ImageIO;

public class MakePsychomorphNeutralBase {
  private static final int OUTPUT_SIZE = 512;

  public static void main(String[] args) throws Exception {
    if (args.length < 3) {
      System.err.println("Usage: java MakePsychomorphNeutralBase <male_image> <female_image> <output_png>");
      System.exit(1);
    }

    File maleFile = new File(args[0]);
    File femaleFile = new File(args[1]);
    File outputFile = new File(args[2]);
    File modelFile = new File("tools/psychomorph/model/sci_mus.asm");

    if (!maleFile.isFile()) {
      throw new IllegalArgumentException("Missing male image: " + maleFile.getPath());
    }
    if (!femaleFile.isFile()) {
      throw new IllegalArgumentException("Missing female image: " + femaleFile.getPath());
    }
    if (!modelFile.isFile()) {
      throw new IllegalArgumentException("Missing Psychomorph ASM model: " + modelFile.getPath());
    }

    BufferedImage maleImage = toRgb(ImageIO.read(maleFile));
    BufferedImage femaleImage = toRgb(ImageIO.read(femaleFile));

    if (maleImage.getWidth() != femaleImage.getWidth() || maleImage.getHeight() != femaleImage.getHeight()) {
      throw new IllegalArgumentException("Male and female base images must have the same dimensions.");
    }

    ASM asm = new ASM();
    asm.read(modelFile.getPath(), 0.95);

    Template maleTemplate = asm.delineate(maleImage, anchorPoints(maleImage));
    Template femaleTemplate = asm.delineate(femaleImage, anchorPoints(femaleImage));

    File imageDir = outputFile.getParentFile();
    if (imageDir != null) {
      imageDir.mkdirs();
    }

    maleTemplate.write(new File(imageDir, "Male_base_psychomorph.tem").getPath());
    femaleTemplate.write(new File(imageDir, "Female_base_psychomorph.tem").getPath());

    ArrayList<Template> templates = new ArrayList<Template>();
    templates.add(maleTemplate);
    templates.add(femaleTemplate);

    Template averageTemplate = new Template();
    averageTemplate.average(templates, asm.getNormalisation(), asm.getNormalisationPoints());
    averageTemplate.write(new File(imageDir, "rc_base_neutral_psychomorph.tem").getPath());

    BufferedImage maleWarped = warpToTemplate(maleImage, maleTemplate, averageTemplate);
    BufferedImage femaleWarped = warpToTemplate(femaleImage, femaleTemplate, averageTemplate);
    BufferedImage nativeAverage = average(maleWarped, femaleWarped);

    File nativeOutput = new File(imageDir, "rc_base_neutral_psychomorph_native.png");
    ImageIO.write(nativeAverage, "png", nativeOutput);

    BufferedImage finalImage = resizeCover(nativeAverage, OUTPUT_SIZE, OUTPUT_SIZE);
    ImageIO.write(finalImage, "png", outputFile);

    System.out.println("Wrote " + outputFile.getPath());
    System.out.println("Wrote " + nativeOutput.getPath());
  }

  private static Point2D.Float[] anchorPoints(BufferedImage image) {
    float width = image.getWidth();
    float height = image.getHeight();
    return new Point2D.Float[] {
      new Point2D.Float(width * 0.365f, height * 0.458f),
      new Point2D.Float(width * 0.635f, height * 0.458f),
      new Point2D.Float(width * 0.500f, height * 0.685f)
    };
  }

  private static BufferedImage warpToTemplate(BufferedImage image, Template sourceTemplate, Template targetTemplate) {
    Warp warp = Warp.createWarp(Warp.LINEAR, targetTemplateWidth(image), targetTemplateHeight(image), image.getWidth(), image.getHeight(), false);
    warp.interpolate(sourceTemplate, targetTemplate, true, true, false);
    return warp.warpImage(image);
  }

  private static int targetTemplateWidth(BufferedImage image) {
    return image.getWidth();
  }

  private static int targetTemplateHeight(BufferedImage image) {
    return image.getHeight();
  }

  private static BufferedImage average(BufferedImage first, BufferedImage second) {
    BufferedImage output = new BufferedImage(first.getWidth(), first.getHeight(), BufferedImage.TYPE_INT_RGB);

    for (int y = 0; y < first.getHeight(); y++) {
      for (int x = 0; x < first.getWidth(); x++) {
        int a = first.getRGB(x, y);
        int b = second.getRGB(x, y);

        int r = (((a >> 16) & 255) + ((b >> 16) & 255)) / 2;
        int g = (((a >> 8) & 255) + ((b >> 8) & 255)) / 2;
        int bl = ((a & 255) + (b & 255)) / 2;

        output.setRGB(x, y, (r << 16) | (g << 8) | bl);
      }
    }

    return output;
  }

  private static BufferedImage resizeCover(BufferedImage input, int width, int height) {
    double scale = Math.max((double) width / input.getWidth(), (double) height / input.getHeight());
    int scaledWidth = (int) Math.round(input.getWidth() * scale);
    int scaledHeight = (int) Math.round(input.getHeight() * scale);

    BufferedImage scaled = new BufferedImage(scaledWidth, scaledHeight, BufferedImage.TYPE_INT_RGB);
    Graphics2D g = scaled.createGraphics();
    g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
    g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    g.drawImage(input, 0, 0, scaledWidth, scaledHeight, null);
    g.dispose();

    int x = Math.max(0, (scaledWidth - width) / 2);
    int y = Math.max(0, (scaledHeight - height) / 2);
    BufferedImage cropped = scaled.getSubimage(x, y, width, height);

    BufferedImage output = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
    Graphics2D out = output.createGraphics();
    out.drawImage(cropped, 0, 0, null);
    out.dispose();
    return output;
  }

  private static BufferedImage toRgb(BufferedImage input) {
    BufferedImage output = new BufferedImage(input.getWidth(), input.getHeight(), BufferedImage.TYPE_INT_RGB);
    Graphics2D g = output.createGraphics();
    g.drawImage(input, 0, 0, null);
    g.dispose();
    return output;
  }
}
