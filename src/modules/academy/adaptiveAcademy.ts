import { dbService } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { cryptoRandomUUID } from '../../utils/crypto.js';
import { verifiableCredentials } from '../credentials/verifiableCredentials.js';

export interface LessonItem {
  id: string;
  title: string;
  content: string;
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
    difficulty: 'easy' | 'medium' | 'hard';
  };
}

export interface AcademyCourseRecord {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  instructor_id: string;
  lessons_json: string;
  price_cents: number;
  is_published: number;
  created_at: number;
}

export interface AcademyEnrollmentRecord {
  id: string;
  course_id: string;
  tenant_id: string;
  user_id: string;
  progress_percentage: number;
  quiz_scores_json: string;
  completed_at: number | null;
  created_at: number;
}

export class AdaptiveAcademyService {
  /**
   * REQ-23.14.1: Publish a new course with lessons and quizzes
   */
  public createCourse(
    tenantId: string,
    instructorId: string,
    title: string,
    description: string,
    lessons: LessonItem[],
    priceCents = 0
  ): AcademyCourseRecord {
    const id = cryptoRandomUUID();
    const now = Date.now();

    dbService.run(
      `INSERT INTO academy_courses (
         id, tenant_id, title, description, instructor_id, lessons_json, price_cents, is_published, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      id,
      tenantId,
      title,
      description,
      instructorId,
      JSON.stringify(lessons),
      priceCents,
      now
    );

    return {
      id,
      tenant_id: tenantId,
      title,
      description,
      instructor_id: instructorId,
      lessons_json: JSON.stringify(lessons),
      price_cents: priceCents,
      is_published: 1,
      created_at: now
    };
  }

  public getCourse(courseId: string): AcademyCourseRecord | null {
    return dbService.get<AcademyCourseRecord>(
      `SELECT * FROM academy_courses WHERE id = ?`,
      courseId
    ) || null;
  }

  /**
   * REQ-23.14.3: Enroll a user in a course
   */
  public enrollUser(tenantId: string, courseId: string, userId: string): AcademyEnrollmentRecord {
    const existing = dbService.get<AcademyEnrollmentRecord>(
      `SELECT * FROM academy_enrollments WHERE course_id = ? AND user_id = ?`,
      courseId,
      userId
    );

    if (existing) return existing;

    const id = cryptoRandomUUID();
    const now = Date.now();

    dbService.run(
      `INSERT INTO academy_enrollments (
         id, course_id, tenant_id, user_id, progress_percentage, quiz_scores_json, completed_at, created_at
       ) VALUES (?, ?, ?, ?, 0.0, '{}', NULL, ?)`,
      id,
      courseId,
      tenantId,
      userId,
      now
    );

    return {
      id,
      course_id: courseId,
      tenant_id: tenantId,
      user_id: userId,
      progress_percentage: 0.0,
      quiz_scores_json: '{}',
      completed_at: null,
      created_at: now
    };
  }

  /**
   * REQ-23.14.2 & REQ-23.14.4: Submit quiz answer, advance progress, and trigger graduation diploma
   */
  public submitLessonQuiz(
    courseId: string,
    userId: string,
    lessonId: string,
    selectedOptionIndex: number
  ): {
    passed: boolean;
    currentProgress: number;
    isCourseCompleted: boolean;
    credentialId?: string;
    nextRecommendedPacing: 'accelerated' | 'standard' | 'supplemental_review';
  } {
    const course = this.getCourse(courseId);
    if (!course) throw new Error('Course not found');

    const lessons: LessonItem[] = JSON.parse(course.lessons_json);
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) throw new Error('Lesson not found');

    const enrollment = this.enrollUser(course.tenant_id, courseId, userId);
    const quizScores: Record<string, number> = JSON.parse(enrollment.quiz_scores_json);

    let passed = true;
    if (lesson.quiz) {
      passed = selectedOptionIndex === lesson.quiz.correctIndex;
      quizScores[lessonId] = passed ? 100 : 0;
    } else {
      quizScores[lessonId] = 100;
    }

    // Compute overall progress
    const passedCount = Object.values(quizScores).filter(s => s >= 80).length;
    const currentProgress = Number(((passedCount / lessons.length) * 100).toFixed(1));
    const isCourseCompleted = currentProgress >= 100.0;

    let completedAt = enrollment.completed_at;
    let credentialId: string | undefined;

    if (isCourseCompleted && !completedAt) {
      completedAt = Date.now();
      // REQ-23.14.4: Trigger verifiable credential diploma
      const cred = verifiableCredentials.issueCredential(course.tenant_id, {
        recipientId: userId,
        credentialType: 'academy_diploma',
        claims: {
          courseId: course.id,
          courseTitle: course.title,
          instructorId: course.instructor_id,
          graduatedAt: completedAt
        },
        expiresInDays: 730
      });
      credentialId = cred.id;
    }

    dbService.run(
      `UPDATE academy_enrollments
       SET progress_percentage = ?, quiz_scores_json = ?, completed_at = ?
       WHERE id = ?`,
      currentProgress,
      JSON.stringify(quizScores),
      completedAt,
      enrollment.id
    );

    // REQ-23.14.2: Adaptive difficulty pacing
    let nextRecommendedPacing: 'accelerated' | 'standard' | 'supplemental_review' = 'standard';
    if (!passed) {
      nextRecommendedPacing = 'supplemental_review';
    } else if (lesson.quiz?.difficulty === 'hard' && passed) {
      nextRecommendedPacing = 'accelerated';
    }

    return {
      passed,
      currentProgress,
      isCourseCompleted,
      credentialId,
      nextRecommendedPacing
    };
  }

  public getEnrollment(courseId: string, userId: string): AcademyEnrollmentRecord | null {
    return dbService.get<AcademyEnrollmentRecord>(
      `SELECT * FROM academy_enrollments WHERE course_id = ? AND user_id = ?`,
      courseId,
      userId
    ) || null;
  }
}

export const adaptiveAcademy = new AdaptiveAcademyService();
